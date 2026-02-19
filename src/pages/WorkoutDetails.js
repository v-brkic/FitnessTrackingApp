// src/pages/WorkoutDetails.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import DifficultySlider from "../components/DifficultySlider";
import Modal from "../components/Modal";
import {
  subscribeWorkout,
  deleteWorkout,
  updateWorkoutFull,
  addExerciseLog,
} from "../store/workoutsCloud";

const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Neck",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Core",
  "Cardio",
  "Mobility",
  "Quads",
  "Other",
];

const hasVal = (v) => v !== null && v !== undefined && Number(v) !== 0;
const mkId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// 8h reset (možeš promijeniti na 12h ako želiš)
const TWELVE_H_MS = 8 * 60 * 60 * 1000;

const toMs = (t) => {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") return Date.parse(t) || 0;
  if (typeof t?.toMillis === "function") return t.toMillis();
  try {
    return new Date(t).getTime() || 0;
  } catch {
    return 0;
  }
};

// helpers (upload)
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (e) => resolve(e.target.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const resizeDataURL = (dataUrl, maxW = 1280, maxH = 1280, quality = 0.85) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.round(img.width * s);
      const h = Math.round(img.height * s);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });

// inflate/flatten za superset u editoru
function inflateFromExercises(exercises = []) {
  const out = [];
  for (let i = 0; i < exercises.length; i++) {
    const a = exercises[i];
    const b = exercises[i + 1];
    if (a?.superId && b?.superId && a.superId === b.superId) {
      out.push({
        _superset: true,
        superId: a.superId,
        a: {
          name: a.name || "",
          group: a.group || "Chest",
          sets: a.sets ?? "",
          reps: a.reps ?? "",
          minutes: a.minutes ?? "",
          weight: a.weight ?? "",
        },
        b: {
          name: b.name || "",
          group: b.group || "Chest",
          sets: b.sets ?? "",
          reps: b.reps ?? "",
          minutes: b.minutes ?? "",
          weight: b.weight ?? "",
        },
      });
      i++;
    } else {
      out.push({
        _superset: false,
        a: {
          name: a.name || "",
          group: a.group || "Chest",
          sets: a.sets ?? "",
          reps: a.reps ?? "",
          minutes: a.minutes ?? "",
          weight: a.weight ?? "",
        },
      });
    }
  }
  return out;
}

/**
 * flattenToExercises s očuvanjem done / doneAt (po indeksu).
 */
function flattenToExercises(rows = [], prevExercises = []) {
  const n = (v) => (v === "" || v == null ? null : Number(v));
  const out = [];
  const prev = Array.isArray(prevExercises) ? prevExercises : [];
  let idx = 0;

  for (const r of rows) {
    if (r._superset) {
      const sid = r.superId || mkId();
      const prevA = prev[idx++] || {};
      const prevB = prev[idx++] || {};

      out.push({
        name: (r.a.name || "").trim(),
        group: r.a.group || "Other",
        sets: n(r.a.sets),
        reps: n(r.a.reps),
        minutes: n(r.a.minutes),
        weight: n(r.a.weight),
        superId: sid,
        done: !!prevA.done,
        doneAt: prevA.doneAt || null,
      });

      out.push({
        name: (r.b.name || "").trim(),
        group: r.b.group || "Other",
        sets: n(r.b.sets),
        reps: n(r.b.reps),
        minutes: n(r.b.minutes),
        weight: n(r.b.weight),
        superId: sid,
        done: !!prevB.done,
        doneAt: prevB.doneAt || null,
      });
    } else {
      const prevE = prev[idx++] || {};
      out.push({
        name: (r.a.name || "").trim(),
        group: r.a.group || "Other",
        sets: n(r.a.sets),
        reps: n(r.a.reps),
        minutes: n(r.a.minutes),
        weight: n(r.a.weight),
        superId: null,
        done: !!prevE.done,
        doneAt: prevE.doneAt || null,
      });
    }
  }
  return out;
}

export default function WorkoutDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [workout, setWorkout] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);

  // draft editor
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [rows, setRows] = useState([]);

  // subscribe
  useEffect(() => {
    const unsub = subscribeWorkout(id, (w) => setWorkout(w));
    return () => unsub && unsub();
  }, [id]);

  // AUTO-RESET: čim stigne workout, resetiraj sve što je “done” dulje od 8h
  useEffect(() => {
    if (!workout || !Array.isArray(workout.exercises)) return;

    const now = Date.now();
    let changed = false;

    const updated = workout.exercises.map((ex) => {
      if (ex?.done && ex?.doneAt) {
        const age = now - toMs(ex.doneAt);
        if (age >= TWELVE_H_MS) {
          changed = true;
          return { ...ex, done: false, doneAt: null };
        }
      }
      return ex;
    });

    if (changed) {
      updateWorkoutFull(workout.id, { exercises: updated }).catch(
        console.error
      );
    }
  }, [workout?.id, workout?.exercises]);

  // popuni draft kad se modal otvori
  useEffect(() => {
    if (!openEdit || !workout) return;
    setName(workout.name || "");
    setDifficulty(Number(workout.difficulty || 0));
    setImageUrl(workout.imageUrl || "");
    setImageData("");
    setRows(inflateFromExercises(workout.exercises || []));
  }, [openEdit, workout]);

  const isLoading = !workout;

  // editor handlers
  const addSingle = () =>
    setRows((arr) => [
      ...arr,
      {
        _superset: false,
        a: {
          name: "",
          group: "Chest",
          sets: "",
          reps: "",
          minutes: "",
          weight: "",
        },
      },
    ]);

  const addSuperset = () =>
    setRows((arr) => [
      ...arr,
      {
        _superset: true,
        superId: mkId(),
        a: {
          name: "",
          group: "Chest",
          sets: "",
          reps: "",
          minutes: "",
          weight: "",
        },
        b: {
          name: "",
          group: "Chest",
          sets: "",
          reps: "",
          minutes: "",
          weight: "",
        },
      },
    ]);

  const toggleToSuperset = (idx, on) =>
    setRows((arr) =>
      arr.map((r, i) =>
        i !== idx
          ? r
          : on
          ? {
              _superset: true,
              superId: mkId(),
              a: r.a,
              b: {
                name: "",
                group: "Chest",
                sets: "",
                reps: "",
                minutes: "",
                weight: "",
              },
            }
          : { _superset: false, a: r.a }
      )
    );

  const updateA = (idx, field, val) =>
    setRows((arr) =>
      arr.map((r, i) =>
        i === idx ? { ...r, a: { ...r.a, [field]: val } } : r
      )
    );
  const updateB = (idx, field, val) =>
    setRows((arr) =>
      arr.map((r, i) =>
        i === idx ? { ...r, b: { ...r.b, [field]: val } } : r
      )
    );
  const removeRow = (idx) =>
    setRows((arr) => arr.filter((_, i) => i !== idx));

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!rows.length) return false;
    return rows.every(
      (r) =>
        (r.a?.name || "").trim() &&
        (!r._superset || (r.b && (r.b.name || "").trim()))
    );
  }, [name, rows]);

  const onFile = async (file) => {
    if (!file) return;
    const raw = await readFileAsDataURL(file);
    const resized = await resizeDataURL(raw, 1280, 1280, 0.85);
    setImageData(resized);
    setImageUrl("");
  };

  const saveEdit = async () => {
    if (!workout) return;
    const finalExercises = flattenToExercises(
      rows,
      workout.exercises || []
    );

    await updateWorkoutFull(workout.id, {
      name: name.trim(),
      difficulty,
      imageUrl: imageData || imageUrl || "",
      exercises: finalExercises,
    });
    setOpenEdit(false);
  };

  const handleDelete = async () => {
    await deleteWorkout(workout.id);
    navigate("/workouts", { replace: true });
  };

  /**
   * Toggle “gotovo” za jednu vježbu:
   * - zapisuje done/doneAt u workout.exercises
   * - AKO je upravo označena na done → upisuje log u exerciseLogs
   * - auto-reset nakon 8h NE briše logove (statistika ostaje)
   */
  const markDone = async (idx) => {
    if (!workout) return;
    const list = (workout.exercises || []).map((x) => ({ ...x }));
    const ex = list[idx];
    if (!ex) return;

    const wasDone = !!ex.done;
    const now = new Date();

    if (wasDone) {
      // ručno odznačavanje – samo skini flag, NE briši logove
      list[idx].done = false;
      list[idx].doneAt = null;
    } else {
      list[idx].done = true;
      list[idx].doneAt = now.toISOString();
    }

    try {
      await updateWorkoutFull(workout.id, { exercises: list });

      // ako je sada postalo "done" → zapiši u exerciseLogs
      if (!wasDone) {
        await addExerciseLog({
          workoutId: workout.id,
          workoutName: workout.name || "",
          exerciseIndex: idx,
          exerciseName: ex.name || "",
          group: ex.group || "Other",
          weight:
            typeof ex.weight === "number"
              ? ex.weight
              : ex.weight != null
              ? Number(ex.weight)
              : null,
          sets:
            typeof ex.sets === "number"
              ? ex.sets
              : ex.sets != null
              ? Number(ex.sets)
              : null,
          reps:
            typeof ex.reps === "number"
              ? ex.reps
              : ex.reps != null
              ? Number(ex.reps)
              : null,
          minutes:
            typeof ex.minutes === "number"
              ? ex.minutes
              : ex.minutes != null
              ? Number(ex.minutes)
              : null,
          performedAt: now,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <div className="container page narrow corner-grad">
        <div className="backbar">
          <button className="btn-back" onClick={() => navigate("/workouts")}>
            ←
          </button>
          <h2 className="page-title" style={{ margin: 0 }}>
            {isLoading ? "Loading…" : workout.name}
          </h2>
          <div className="backbar-right">
            {!isLoading && (
              <button
                className="icon-btn"
                onClick={() => setOpenEdit(true)}
                title="Uredi"
              >
                ✎
              </button>
            )}
            {!isLoading && (
              <button
                className="icon-btn danger"
                onClick={handleDelete}
                title="Obriši"
              >
                🗑
              </button>
            )}
          </div>
        </div>

        {!isLoading && (
          <>
            <div className="card hero-card">
              <div className="hero-media">
                {workout.imageUrl ? (
                  <img
                    src={workout.imageUrl}
                    alt=""
                    onError={(e) =>
                      (e.currentTarget.style.display = "none")
                    }
                  />
                ) : null}
                <div className="hero-gradient" />
              </div>
              <div className="hero-body">
                <div className="hero-row">
                  <span className="muted">Intensity</span>
                  <DifficultySlider
                    value={workout.difficulty}
                    readOnly
                    size="sm"
                  />
                </div>
                <div className="hero-row">
                  <span className="muted">Number of exercises</span>
                  <span className="badge">
                    {workout.exercises?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="card glow-tl">
              <div className="body">
                <h3 className="section-title" style={{ marginTop: 0 }}>
                  Exercises
                </h3>

                <ul className="exercise-rows">
                  {(() => {
                    const xs = workout.exercises || [];
                    const fmt = (v) => {
                      const n = Number(v);
                      if (Number.isNaN(n)) return "";
                      return n % 1 === 0 ? String(n) : n.toFixed(1);
                    };

                    // prvo pripremimo blokove da ispravno držimo indexe za superset
                    const blocks = [];
                    for (let i = 0; i < xs.length; ) {
                      const a = xs[i];
                      const b = xs[i + 1];
                      if (
                        a?.superId &&
                        b?.superId &&
                        a.superId === b.superId
                      ) {
                        blocks.push({
                          type: "superset",
                          idxA: i,
                          idxB: i + 1,
                          a,
                          b,
                        });
                        i += 2;
                      } else {
                        blocks.push({
                          type: "single",
                          idx: i,
                          e: a,
                        });
                        i += 1;
                      }
                    }

                    return blocks.map((block, blockIdx) => {
                      if (block.type === "superset") {
                        const { a, b, idxA, idxB } = block;
                        return (
                          <li
                            key={`sup-${blockIdx}`}
                            className="ex-superset onebox"
                          >
                            {/* A */}
                            <div
                              className={`ex-row sub ${
                                a.done ? "done" : ""
                              }`}
                            >
                              {hasVal(a.weight) && (
                                <div className="ex-weight-center desktop-only">
                                  <strong>{fmt(a.weight)}</strong>
                                  <span className="unit">kg</span>
                                </div>
                              )}

                              <div className="ex-left">
                                <div className="ex-title">{a.name}</div>
                                <div className="ex-sub muted">
                                  {a.group || "—"}
                                </div>
                              </div>

                              <div className="ex-right">
                                {hasVal(a.sets) && (
                                  <span className="pill pill-sets">
                                    {a.sets} sets
                                  </span>
                                )}
                                {hasVal(a.reps) && (
                                  <span className="pill pill-reps">
                                    {a.reps} reps
                                  </span>
                                )}
                                {hasVal(a.minutes) && (
                                  <span className="pill pill-min">
                                    {a.minutes} min
                                  </span>
                                )}

                                {hasVal(a.weight) && (
                                  <span className="pill weight-inline mobile-only">
                                    <strong>{fmt(a.weight)}</strong> kg
                                  </span>
                                )}

                                <button
                                  className={`pill-btn ${
                                    a.done ? "on" : ""
                                  }`}
                                  onClick={() => markDone(idxA)}
                                >
                                  ✓ Done
                                </button>
                              </div>
                            </div>

                            <div className="sup-divider">
                              <span className="sup-arrows">⇄</span>
                              <span className="sup-text">SUPERSET</span>
                            </div>

                            {/* B */}
                            <div
                              className={`ex-row sub ${
                                b.done ? "done" : ""
                              }`}
                            >
                              {hasVal(b.weight) && (
                                <div className="ex-weight-center desktop-only">
                                  <strong>{fmt(b.weight)}</strong>
                                  <span className="unit">kg</span>
                                </div>
                              )}

                              <div className="ex-left">
                                <div className="ex-title">{b.name}</div>
                                <div className="ex-sub muted">
                                  {b.group || "—"}
                                </div>
                              </div>

                              <div className="ex-right">
                                {hasVal(b.sets) && (
                                  <span className="pill pill-sets">
                                    {b.sets} sets
                                  </span>
                                )}
                                {hasVal(b.reps) && (
                                  <span className="pill pill-reps">
                                    {b.reps} reps
                                  </span>
                                )}
                                {hasVal(b.minutes) && (
                                  <span className="pill pill-min">
                                    {b.minutes} min
                                  </span>
                                )}

                                {hasVal(b.weight) && (
                                  <span className="pill weight-inline mobile-only">
                                    <strong>{fmt(b.weight)}</strong> kg
                                  </span>
                                )}

                                <button
                                  className={`pill-btn ${
                                    b.done ? "on" : ""
                                  }`}
                                  onClick={() => markDone(idxB)}
                                >
                                  ✓ Done
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      }

                      // single exercise
                      const { e, idx } = block;
                      return (
                        <li
                          key={idx}
                          className={`ex-row ${e.done ? "done" : ""}`}
                        >
                          {hasVal(e.weight) && (
                            <div className="ex-weight-center desktop-only">
                              <strong>{fmt(e.weight)}</strong>
                              <span className="unit">kg</span>
                            </div>
                          )}

                          <div className="ex-left">
                            <div className="ex-title">{e.name}</div>
                            <div className="ex-sub muted">
                              {e.group || "—"}
                            </div>
                          </div>

                          <div className="ex-right">
                            {hasVal(e.sets) && (
                              <span className="pill pill-sets">
                                {e.sets} sets
                              </span>
                            )}
                            {hasVal(e.reps) && (
                              <span className="pill pill-reps">
                                {e.reps} reps
                              </span>
                            )}
                            {hasVal(e.minutes) && (
                              <span className="pill pill-min">
                                {e.minutes} min
                              </span>
                            )}

                            {hasVal(e.weight) && (
                              <span className="pill weight-inline mobile-only">
                                <strong>{fmt(e.weight)}</strong> kg
                              </span>
                            )}

                            <button
                              className={`pill-btn ${
                                e.done ? "on" : ""
                              }`}
                              onClick={() => markDone(idx)}
                            >
                              ✓ Done
                            </button>
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      {/* EDIT MODAL */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Uredi trening"
        footer={
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setOpenEdit(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!canSave}
              onClick={saveEdit}
            >
              Save changes
            </button>
          </div>
        }
      >
        <div className="form-row">
          <label>Training label</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Push – Strength"
          />
        </div>

        <div className="form-row">
          <label>Image (upload or URL)</label>
          <div className="upload-wrap">
            <input
              type="file"
              accept="image/*"
              className="file-input"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const raw = await readFileAsDataURL(f);
                  const resized = await resizeDataURL(raw);
                  setImageData(resized);
                  setImageUrl("");
                }
              }}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              or paste URL
            </span>
            <input
              className="input"
              type="url"
              placeholder="https://…"
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImageData("");
              }}
            />
          </div>
          {imageData || imageUrl ? (
            <div className="img-preview">
              <img src={imageData || imageUrl} alt="Preview" />
            </div>
          ) : null}
        </div>

        <div className="form-row">
          <label>Weight</label>
          <DifficultySlider value={difficulty} onChange={setDifficulty} />
        </div>

        <div className="form-row">
          <label>Exercises</label>
          <div className="exercise-list">
            {rows.map((r, i) => (
              <div
                key={i}
                className="exercise-row nice"
                style={{ width: "100%" }}
              >
                <div className="sup-row-head">
                  <label className="sup-toggle">
                    <input
                      type="checkbox"
                      checked={!!r._superset}
                      onChange={(e) =>
                        toggleToSuperset(i, e.target.checked)
                      }
                    />
                    <span>Superset</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => removeRow(i)}
                    title="Ukloni"
                  >
                    −
                  </button>
                </div>

                <div
                  className={`sup-form ${
                    r._superset ? "is-super" : "not-super"
                  }`}
                >
                  {r._superset && <span className="sup-tag">A</span>}
                  <input
                    className="input name"
                    placeholder="Exercise label"
                    value={r.a.name}
                    onChange={(e) => updateA(i, "name", e.target.value)}
                  />
                  <input
                    className="input sets"
                    type="number"
                    min="0"
                    placeholder="Sets"
                    value={r.a.sets}
                    onChange={(e) => updateA(i, "sets", e.target.value)}
                  />
                  <input
                    className="input reps"
                    type="number"
                    min="0"
                    placeholder="Reps"
                    value={r.a.reps}
                    onChange={(e) => updateA(i, "reps", e.target.value)}
                  />
                  <input
                    className="input minutes"
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={r.a.minutes}
                    onChange={(e) => updateA(i, "minutes", e.target.value)}
                  />
                  <input
                    className="input weight"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="kg"
                    value={r.a.weight}
                    onChange={(e) => updateA(i, "weight", e.target.value)}
                  />
                  <select
                    className="input group"
                    value={r.a.group}
                    onChange={(e) => updateA(i, "group", e.target.value)}
                  >
                    {MUSCLE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {r._superset && (
                  <div className="sup-form is-super">
                    <span className="sup-tag sup-b">B</span>
                    <input
                      className="input name"
                      placeholder="Exercise label"
                      value={r.b.name}
                      onChange={(e) => updateB(i, "name", e.target.value)}
                    />
                    <input
                      className="input sets"
                      type="number"
                      min="0"
                      placeholder="Sets"
                      value={r.b.sets}
                      onChange={(e) => updateB(i, "sets", e.target.value)}
                    />
                    <input
                      className="input reps"
                      type="number"
                      min="0"
                      placeholder="Reps"
                      value={r.b.reps}
                      onChange={(e) => updateB(i, "reps", e.target.value)}
                    />
                    <input
                      className="input minutes"
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={r.b.minutes}
                      onChange={(e) => updateB(i, "minutes", e.target.value)}
                    />
                    <input
                      className="input weight"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="kg"
                      value={r.b.weight}
                      onChange={(e) => updateB(i, "weight", e.target.value)}
                    />
                    <select
                      className="input group"
                      value={r.b.group}
                      onChange={(e) => updateB(i, "group", e.target.value)}
                    >
                      {MUSCLE_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-ghost small"
                onClick={addSingle}
              >
                + Add exercise
              </button>
              <button
                type="button"
                className="btn-ghost small"
                onClick={addSuperset}
              >
                + Add superset
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </>
  );
}
