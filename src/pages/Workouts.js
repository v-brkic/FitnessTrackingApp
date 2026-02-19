// src/pages/Workouts.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import Modal from "../components/Modal";
import DifficultySlider from "../components/DifficultySlider";
import {
  subscribeWorkouts,
  addWorkout,
  deleteWorkout,
  startOfWeek,
  addDays,
  toIsoDate,
  subscribeLogsInRange,
  addLogForWorkout,
  removeLogForWorkoutOnDate,
  getWorkout,
  updateWorkoutFull,
} from "../store/workoutsCloud";

const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Glutes",
  "Core",
  "Cardio",
  "Mobility",
  "Other",
];

const mkId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const readFileAsDataURL = (file) =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = (e) => res(e.target.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

const resizeDataURL = (dataUrl, maxW = 1280, maxH = 1280, q = 0.85) =>
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
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.src = dataUrl;
  });

/**
 * Pretvara draft rows (create / edit) u exercises array.
 * Ako dobiješ prevExercises, prenosi done / doneAt po indeksu.
 */
const flattenToExercises = (draftRows = [], prevExercises = []) => {
  const n = (v) => (v === "" || v == null ? null : Number(v));
  const out = [];
  const prev = Array.isArray(prevExercises) ? prevExercises : [];
  let idx = 0;

  for (const r of draftRows) {
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
};

export default function Workouts() {
  const navigate = useNavigate();

  const [workouts, setWorkouts] = useState([]);
  useEffect(() => {
    const unsub = subscribeWorkouts(setWorkouts);
    return () => unsub && unsub();
  }, []);

  // ===== CREATE =====
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [rows, setRows] = useState([
    {
      _superset: false,
      a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
    },
  ]);

  const addSingle = () =>
    setRows((arr) => [
      ...arr,
      {
        _superset: false,
        a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
      },
    ]);

  const addSuperset = () =>
    setRows((arr) => [
      ...arr,
      {
        _superset: true,
        superId: mkId(),
        a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
        b: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
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
              b: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
            }
          : { _superset: false, a: r.a }
      )
    );

  const updateA = (idx, field, val) =>
    setRows((arr) => arr.map((r, i) => (i === idx ? { ...r, a: { ...r.a, [field]: val } } : r)));
  const updateB = (idx, field, val) =>
    setRows((arr) => arr.map((r, i) => (i === idx ? { ...r, b: { ...r.b, [field]: val } } : r)));
  const removeRow = (idx) => setRows((arr) => arr.filter((_, i) => i !== idx));

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (!rows.length) return false;
    return rows.every(
      (r) => (r.a?.name || "").trim() && (!r._superset || (r.b && (r.b.name || "").trim()))
    );
  }, [name, rows]);

  const handleCreate = async () => {
    if (!canSave) return;
    const picture = imageData || imageUrl.trim();
    const exercises = flattenToExercises(rows);

    await addWorkout({
      name: name.trim(),
      imageUrl: picture || "",
      difficulty: Number(difficulty || 0),
      exercises,
    });

    setOpen(false);
    setName("");
    setImageUrl("");
    setImageData("");
    setDifficulty(0);
    setRows([
      { _superset: false, a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" } },
    ]);
  };

  // ===== EDIT (iz liste) =====
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [eName, setEName] = useState("");
  const [eDiff, setEDiff] = useState(0);
  const [eImageUrl, setEImageUrl] = useState("");
  const [eImageData, setEImageData] = useState("");
  const [eRows, setERows] = useState([]);

  const inflateFromExercises = (ex = []) => {
    const out = [];
    for (let i = 0; i < ex.length; i++) {
      const a = ex[i];
      const b = ex[i + 1];
      if (a?.superId && b?.superId && a.superId === b.superId) {
        out.push({
          _superset: true,
          superId: a.superId,
          a: { name: a.name || "", group: a.group || "Chest", sets: a.sets ?? "", reps: a.reps ?? "", minutes: a.minutes ?? "", weight: a.weight ?? "" },
          b: { name: b.name || "", group: b.group || "Chest", sets: b.sets ?? "", reps: b.reps ?? "", minutes: b.minutes ?? "", weight: b.weight ?? "" },
        });
        i++;
      } else {
        out.push({
          _superset: false,
          a: { name: a.name || "", group: a.group || "Chest", sets: a.sets ?? "", reps: a.reps ?? "", minutes: a.minutes ?? "", weight: a.weight ?? "" },
        });
      }
    }
    return out;
  };

  const openEditFor = async (id) => {
    const w = await getWorkout(id);
    if (!w) return;
    setEditId(id);
    setEName(w.name || "");
    setEDiff(Number(w.difficulty || 0));
    setEImageUrl(w.imageUrl || "");
    setEImageData("");
    setERows(inflateFromExercises(w.exercises || []));
    setOpenEdit(true);
  };

  const eAddSingle = () =>
    setERows((arr) => [
      ...arr,
      { _superset: false, a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" } },
    ]);

  const eAddSuperset = () =>
    setERows((arr) => [
      ...arr,
      {
        _superset: true,
        superId: mkId(),
        a: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
        b: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
      },
    ]);

  const eToggleToSuperset = (idx, on) =>
    setERows((arr) =>
      arr.map((r, i) =>
        i !== idx
          ? r
          : on
          ? {
              _superset: true,
              superId: mkId(),
              a: r.a,
              b: { name: "", group: "Chest", sets: "", reps: "", minutes: "", weight: "" },
            }
          : { _superset: false, a: r.a }
      )
    );

  const eUpdateA = (idx, field, val) =>
    setERows((arr) => arr.map((r, i) => (i === idx ? { ...r, a: { ...r.a, [field]: val } } : r)));
  const eUpdateB = (idx, field, val) =>
    setERows((arr) => arr.map((r, i) => (i === idx ? { ...r, b: { ...r.b, [field]: val } } : r)));
  const eRemoveRow = (idx) => setERows((arr) => arr.filter((_, i) => i !== idx));

  const saveEdit = async () => {
    if (!editId) return;
    const prev = workouts.find((w) => w.id === editId);
    const prevExercises = prev?.exercises || [];
    const flat = flattenToExercises(eRows, prevExercises);

    await updateWorkoutFull(editId, {
      name: eName.trim(),
      difficulty: eDiff,
      imageUrl: eImageData || eImageUrl || "",
      exercises: flat,
    });

    setOpenEdit(false);
  };

  // ===== Done checkmarks – tjedni grid =====
  const [weekStart] = useState(() => startOfWeek(new Date()));

  // ✅ Mon..Sun
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = days.map((_, i) => toIsoDate(addDays(weekStart, i)));

  const [weekLogs, setWeekLogs] = useState([]);
  useEffect(() => {
    // ✅ end = +6 (Sunday)
    const unsub = subscribeLogsInRange(weekStart, addDays(weekStart, 6), setWeekLogs);
    return () => unsub && unsub();
  }, [weekStart]);

  const isDone = (workoutId, dayIdx) =>
    weekLogs.some((l) => l.workoutId === workoutId && l.date === dates[dayIdx]);

  const toggleDone = async (workout, dayIdx, e) => {
    e.stopPropagation();
    const dateIso = dates[dayIdx];
    if (isDone(workout.id, dayIdx)) {
      await removeLogForWorkoutOnDate(workout.id, dateIso);
    } else {
      await addLogForWorkout(workout, dateIso);
    }
  };

  return (
    <>
      <div className="container page">
        <div className="page-header">
          <div className="workouts-header narrow">
            <h1 className="home-title" style={{ margin: "12px 0 8px", fontSize: 28, fontWeight: 800 }}>
              Workouts
            </h1>
            <div className="actions">
              <button className="btn-pill create-btn" onClick={() => setOpen(true)}>
                +New
              </button>
            </div>
          </div>
        </div>

        <div className="narrow">
          {workouts.length === 0 ? (
            <div className="card empty-state">
              <div className="body">
                Your workout list is empty! Get started <b>Create new workout</b>.
              </div>
            </div>
          ) : (
            <ul className="workout-stack">
              <li className="wk-days">
                <div className="wk-days-grid">
                  {days.map((d, i) => (
                    <span key={i} className="wk-day-label">
                      {d}
                    </span>
                  ))}
                </div>
              </li>

              {workouts.map((w) => (
                <li key={w.id}>
                  <div
                    className="workout-card-list clickable"
                    onClick={() => navigate(`/workouts/${w.id}`)}
                    role="button"
                  >
                    <div className="wc-media">
                      {w.imageUrl ? (
                        <img
                          src={w.imageUrl}
                          alt=""
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ) : null}
                      <div className="wc-gradient" />
                    </div>

                    <div className="wc-info">
                      <div className="wc-top">
                        <div className="wc-title">{w.name}</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="icon-btn"
                            title="Uredi"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditFor(w.id);
                            }}
                          >
                            ✎
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await deleteWorkout(w.id);
                            }}
                            title="Obriši"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      <div className="wc-diff">
                        <DifficultySlider value={w.difficulty} readOnly size="sm" />
                        <span className="badge">{w.exercises?.length || 0} exercises</span>
                      </div>
                    </div>

                    <div className="wk-done">
                      <div className="wk-done-grid">
                        {days.map((_, i) => (
                          <button
                            key={i}
                            className={`check ${isDone(w.id, i) ? "on" : ""}`}
                            onClick={(e) => toggleDone(w, i, e)}
                            title={`${days[i]} – ${isDone(w.id, i) ? "Odznači" : "Označi"} odrađeno`}
                          >
                            ✔
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* CREATE */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Kreiraj trening"
        footer={
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!canSave}
              onClick={handleCreate}
            >
              Create Workout
            </button>
          </div>
        }
      >
        <div className="form-row">
          <label>Training label</label>
          <input
            className="input"
            type="text"
            placeholder="npr. Push – Strength"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>Image (upload or URL)</label>
          <div className="upload-wrap">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const raw = await readFileAsDataURL(f);
                  const resized = await resizeDataURL(raw);
                  setImageData(resized);
                  setImageUrl("");
                }
              }}
              className="file-input"
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
          <label>Difficulty</label>
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
                      onChange={(e) => toggleToSuperset(i, e.target.checked)}
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

      {/* EDIT */}
      <Modal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Uredi trening"
        footer={
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => setOpenEdit(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveEdit}>
              Save changes
            </button>
          </div>
        }
      >
        <div className="form-row">
          <label>Training label</label>
          <input
            className="input"
            value={eName}
            onChange={(e) => setEName(e.target.value)}
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
                  setEImageData(resized);
                  setEImageUrl("");
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
              value={eImageUrl}
              onChange={(e) => {
                setEImageUrl(e.target.value);
                setEImageData("");
              }}
            />
          </div>
          {eImageData || eImageUrl ? (
            <div className="img-preview">
              <img src={eImageData || eImageUrl} alt="Preview" />
            </div>
          ) : null}
        </div>

        <div className="form-row">
          <label>Difficulty</label>
          <DifficultySlider value={eDiff} onChange={setEDiff} />
        </div>

        <div className="form-row">
          <label>Vježbe</label>
          <div className="exercise-list">
            {eRows.map((r, i) => (
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
                      onChange={(e) => eToggleToSuperset(i, e.target.checked)}
                    />
                    <span>Superset</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => eRemoveRow(i)}
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
                    onChange={(e) => eUpdateA(i, "name", e.target.value)}
                  />
                  <input
                    className="input sets"
                    type="number"
                    min="0"
                    placeholder="Sets"
                    value={r.a.sets}
                    onChange={(e) => eUpdateA(i, "sets", e.target.value)}
                  />
                  <input
                    className="input reps"
                    type="number"
                    min="0"
                    placeholder="Reps"
                    value={r.a.reps}
                    onChange={(e) => eUpdateA(i, "reps", e.target.value)}
                  />
                  <input
                    className="input minutes"
                    type="number"
                    min="0"
                    placeholder="Min"
                    value={r.a.minutes}
                    onChange={(e) => eUpdateA(i, "minutes", e.target.value)}
                  />
                  <input
                    className="input weight"
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="kg"
                    value={r.a.weight}
                    onChange={(e) => eUpdateA(i, "weight", e.target.value)}
                  />
                  <select
                    className="input group"
                    value={r.a.group}
                    onChange={(e) => eUpdateA(i, "group", e.target.value)}
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
                      onChange={(e) => eUpdateB(i, "name", e.target.value)}
                    />
                    <input
                      className="input sets"
                      type="number"
                      min="0"
                      placeholder="Sets"
                      value={r.b.sets}
                      onChange={(e) => eUpdateB(i, "sets", e.target.value)}
                    />
                    <input
                      className="input reps"
                      type="number"
                      min="0"
                      placeholder="Reps"
                      value={r.b.reps}
                      onChange={(e) => eUpdateB(i, "reps", e.target.value)}
                    />
                    <input
                      className="input minutes"
                      type="number"
                      min="0"
                      placeholder="Min"
                      value={r.b.minutes}
                      onChange={(e) => eUpdateB(i, "minutes", e.target.value)}
                    />
                    <input
                      className="input weight"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="kg"
                      value={r.b.weight}
                      onChange={(e) => eUpdateB(i, "weight", e.target.value)}
                    />
                    <select
                      className="input group"
                      value={r.b.group}
                      onChange={(e) => eUpdateB(i, "group", e.target.value)}
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
                onClick={eAddSingle}
              >
                + Add exercise
              </button>
              <button
                type="button"
                className="btn-ghost small"
                onClick={eAddSuperset}
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
