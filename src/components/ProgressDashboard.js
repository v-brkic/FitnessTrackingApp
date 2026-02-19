// src/pages/ProgressDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import {
  onLiftSets,
  addLiftSet,
  onFiveK,
  addFiveK,
  onHrWorkouts,
  addHrWorkout,
  groupWeeklyVolume,
  epley1RM,
  secondsToMmSs,
  mmssToSeconds,
} from "../store/pbsCloud";

// helpers
const LIFTS = [
  { key: "bench", label: "Bench press" },
  { key: "squat", label: "Squat" },
  { key: "deadlift", label: "Deadlift" },
];

const toIsoDate = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

const fmtUiDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
};

// Mali line chart (sparkline) za 1RM / volume
function Sparkline({ points }) {
  if (!points || !points.length) return (
    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
      Nema još dovoljno podataka.
    </div>
  );

  const w = 260, h = 120, padL = 26, padR = 6, padT = 10, padB = 20;
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const sx = (t) =>
    padL + ((t - minX) / spanX) * (w - padL - padR);
  const sy = (y) =>
    (h - padB) - ((y - minY) / spanY) * (h - padT - padB);

  const polyPoints = points
    .map((p) => `${sx(new Date(p.date).getTime())},${sy(p.value)}`)
    .join(" ");

  // x osi (samo krajevi)
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="chart-wrap" style={{ marginTop: 6 }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart">
        {/* vodoravne linije */}
        <line
          x1="0"
          x2={w}
          y1={h - padB}
          y2={h - padB}
          className="axis-line"
        />
        {/* datum lijevo / desno */}
        <text
          x={padL}
          y={h - 4}
          textAnchor="start"
          className="chart-axis-text"
        >
          {fmtUiDate(first.date)}
        </text>
        {points.length > 1 && (
          <text
            x={w - padR}
            y={h - 4}
            textAnchor="end"
            className="chart-axis-text"
          >
            {fmtUiDate(last.date)}
          </text>
        )}

        {/* linija */}
        <polyline
          fill="none"
          strokeWidth="2.5"
          className="chart-line"
          points={polyPoints}
        />

        {/* točke */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={sx(new Date(p.date).getTime())}
            cy={sy(p.value)}
            r="2.5"
            className="chart-dot"
          />
        ))}
      </svg>
    </div>
  );
}

export default function ProgressDashboard() {
  // FIREBASE PODACI
  const [liftSets, setLiftSets] = useState({
    bench: [],
    squat: [],
    deadlift: [],
  });
  const [fiveK, setFiveK] = useState([]);
  const [hrWorkouts, setHrWorkouts] = useState([]);

  // UI state
  const [selectedLift, setSelectedLift] = useState("bench");
  const [liftRange, setLiftRange] = useState("90"); // 30 / 90 / 365

  // modali
  const [modal, setModal] = useState(null); // { type: 'lift' | '5k' | 'hr' }
  const [liftForm, setLiftForm] = useState({
    lift: "bench",
    date: toIsoDate(new Date()),
    weight: "",
    reps: "",
  });
  const [fiveKForm, setFiveKForm] = useState({
    date: toIsoDate(new Date()),
    time: "",
  });
  const [hrForm, setHrForm] = useState({
    date: toIsoDate(new Date()),
    z1: "",
    z2: "",
    z3: "",
    z4: "",
    z5: "",
  });

  // --- Subscriberi na Firestore ---
  useEffect(() => {
    const unsubs = LIFTS.map((lift) =>
      onLiftSets({ lift: lift.key, days: 365 }, (rows) => {
        setLiftSets((prev) => ({ ...prev, [lift.key]: rows || [] }));
      })
    );
    const u5 = onFiveK({ days: 365 }, (rows) => setFiveK(rows || []));
    const uHr = onHrWorkouts({ days: 365 }, (rows) =>
      setHrWorkouts(rows || [])
    );

    return () => {
      unsubs.forEach((u) => u && u());
      u5 && u5();
      uHr && uHr();
    };
  }, []);

  // --- PB izračun za 1RM ---
  const liftPBs = useMemo(() => {
    const out = {};
    LIFTS.forEach((l) => {
      const sets = liftSets[l.key] || [];
      let best = null;
      sets.forEach((s) => {
        const est = epley1RM(s.weight, s.reps || 1);
        const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
        if (!best || est > best.value) {
          best = { value: Number(est.toFixed(1)), date };
        }
      });
      out[l.key] = best;
    });
    return out;
  }, [liftSets]);

  // --- 1RM trend za odabrani lift ---
  const liftTrend = useMemo(() => {
    const all = liftSets[selectedLift] || [];
    if (!all.length) return [];

    // filter po periodu
    const now = new Date();
    const from = new Date(now);
    if (liftRange === "30") from.setDate(now.getDate() - 29);
    if (liftRange === "90") from.setDate(now.getDate() - 89);
    if (liftRange === "365") from.setDate(now.getDate() - 364);

    const filtered = all.filter((s) => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      return d >= from;
    });

    const mapped = filtered.map((s) => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      const est = epley1RM(s.weight, s.reps || 1);
      return {
        date: toIsoDate(d),
        value: Number(est.toFixed(1)),
      };
    });

    // spoji po datumu (uzmi najbolji taj dan)
    const byDate = {};
    mapped.forEach((m) => {
      const existing = byDate[m.date];
      if (!existing || m.value > existing.value) {
        byDate[m.date] = m;
      }
    });

    return Object.values(byDate).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [liftSets, selectedLift, liftRange]);

  // --- Fastest 5K PB ---
  const best5K = useMemo(() => {
    if (!fiveK.length) return null;
    return fiveK.reduce((best, cur) => {
      const sec =
        typeof cur.seconds === "number"
          ? cur.seconds
          : mmssToSeconds(cur.time);
      if (!best || sec < best.seconds) {
        return {
          seconds: sec,
          date: cur.date?.toDate ? cur.date.toDate() : new Date(cur.date),
        };
      }
      return best;
    }, null);
  }, [fiveK]);

  // --- Best HR-zone workout ---
  const bestHr = useMemo(() => {
    if (!hrWorkouts.length) return null;
    return hrWorkouts.reduce((best, cur) => {
      const hi =
        typeof cur.hi === "number"
          ? cur.hi
          : (Number(cur.z3 || 0) +
              Number(cur.z4 || 0) +
              Number(cur.z5 || 0));
      if (!best || hi > best.hi) {
        return {
          hi,
          date: cur.date?.toDate ? cur.date.toDate() : new Date(cur.date),
        };
      }
      return best;
    }, null);
  }, [hrWorkouts]);

  // --- Weekly volume (sva tri lifta zajedno) ---
  const weeklyVolume = useMemo(() => {
    const all = [
      ...(liftSets.bench || []),
      ...(liftSets.squat || []),
      ...(liftSets.deadlift || []),
    ];
    return groupWeeklyVolume(all);
  }, [liftSets]);

  const volumePoints = useMemo(
    () =>
      weeklyVolume.map((w) => ({
        date: w.weekStart,
        value: w.volume,
      })),
    [weeklyVolume]
  );

  // ========== MODALI – OTVARANJE ==========
  const openLiftModal = (liftKey) => {
    setLiftForm({
      lift: liftKey,
      date: toIsoDate(new Date()),
      weight: "",
      reps: "",
    });
    setModal({ type: "lift" });
  };

  const openFiveKModal = () => {
    setFiveKForm({
      date: toIsoDate(new Date()),
      time: "",
    });
    setModal({ type: "5k" });
  };

  const openHrModal = () => {
    setHrForm({
      date: toIsoDate(new Date()),
      z1: "",
      z2: "",
      z3: "",
      z4: "",
      z5: "",
    });
    setModal({ type: "hr" });
  };

  const closeModal = () => setModal(null);

  // ========== MODALI – SPREMANJE ==========
  const saveLiftFromModal = async () => {
    const rawW = String(liftForm.weight || "").replace(",", ".").trim();
    const rawR = String(liftForm.reps || "").trim();
    const w = parseFloat(rawW);
    const r = parseInt(rawR, 10);

    if (!liftForm.lift || !liftForm.date || !isFinite(w) || w <= 0 || !r) {
      alert("Molim unesi valjanu težinu, ponavljanja i datum.");
      return;
    }

    try {
      await addLiftSet({
        lift: liftForm.lift,
        weight: w,
        reps: r,
        date: new Date(liftForm.date),
      });
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Ne mogu spremiti set.");
    }
  };

  const saveFiveKFromModal = async () => {
    const sec = mmssToSeconds(fiveKForm.time);
    if (!fiveKForm.date || !sec) {
      alert("Unesi datum i vrijeme u formatu mm:ss (npr. 21:30).");
      return;
    }
    try {
      await addFiveK({
        seconds: sec,
        date: new Date(fiveKForm.date),
      });
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Ne mogu spremiti 5 km vrijeme.");
    }
  };

  const saveHrFromModal = async () => {
    const z1 = Number((hrForm.z1 || "0").replace(",", "."));
    const z2 = Number((hrForm.z2 || "0").replace(",", "."));
    const z3 = Number((hrForm.z3 || "0").replace(",", "."));
    const z4 = Number((hrForm.z4 || "0").replace(",", "."));
    const z5 = Number((hrForm.z5 || "0").replace(",", "."));

    if (!hrForm.date) {
      alert("Unesi datum treninga.");
      return;
    }

    try {
      await addHrWorkout({
        z1,
        z2,
        z3,
        z4,
        z5,
        date: new Date(hrForm.date),
      });
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Ne mogu spremiti HR workout.");
    }
  };

  const liftLabel = (key) =>
    LIFTS.find((l) => l.key === key)?.label || key;

  // ========== RENDER ==========
  return (
    <>
      <section className="card seamless progress-dashboard">
        <div className="panel-head">
          <div>
            <div className="pp-title" style={{ fontSize: 18, fontWeight: 800 }}>
              Strength & Performance
            </div>
            <div className="pp-sub muted">
              PB cards + trends throughout time
            </div>
          </div>
          <div className="bw-range">
            <button
              className={`range-btn chip ${
                liftRange === "30" ? "active" : ""
              }`}
              onClick={() => setLiftRange("30")}
            >
              30d
            </button>
            <button
              className={`range-btn chip ${
                liftRange === "90" ? "active" : ""
              }`}
              onClick={() => setLiftRange("90")}
            >
              90d
            </button>
            <button
              className={`range-btn chip ${
                liftRange === "365" ? "active" : ""
              }`}
              onClick={() => setLiftRange("365")}
            >
              1y
            </button>
          </div>
        </div>

        <div className="panel-body">
          {/* 1) LIFT PB KARTICE */}
          <div className="stats-grid" style={{ marginBottom: 10 }}>
            {LIFTS.map((l) => {
              const pb = liftPBs[l.key];
              return (
                <div
                  key={l.key}
                  className="stat-card clickable"
                  onClick={() => openLiftModal(l.key)}
                >
                  <div className="stat-value">
                    {pb ? `${pb.value} kg` : "—"}
                  </div>
                  <div className="stat-label">
                    Max {l.label} 1RM (est.)
                  </div>
                  {pb?.date && (
                    <div
                      className="muted"
                      style={{ fontSize: 11, marginTop: 4 }}
                    >
                      PB: {fmtUiDate(pb.date)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 2) TREND GRAF ZA ODABRANI LIFT */}
          <div className="card glow-tl" style={{ marginTop: 4 }}>
            <div className="body">
              <div className="dash-head" style={{ marginBottom: 4 }}>
                <div className="dash-title light">
                  {liftLabel(selectedLift)} 1RM trend
                </div>
                <div className="dash-switch">
                  {LIFTS.map((l) => (
                    <button
                      key={l.key}
                      className={`chip ${
                        selectedLift === l.key ? "active" : ""
                      }`}
                      onClick={() => setSelectedLift(l.key)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <Sparkline points={liftTrend} />
            </div>
          </div>

          {/* 3) DRUGE PB KARTICE (5K, HR, VOLUME) */}
          <div className="stats-grid" style={{ marginTop: 12 }}>
            {/* Fastest 5K */}
            <div
              className="stat-card clickable"
              onClick={openFiveKModal}
            >
              <div className="stat-value">
                {best5K ? secondsToMmSs(best5K.seconds) : "—"}
              </div>
              <div className="stat-label">Fastest 5 km</div>
              {best5K?.date && (
                <div
                  className="muted"
                  style={{ fontSize: 11, marginTop: 4 }}
                >
                  PB: {fmtUiDate(best5K.date)}
                </div>
              )}
            </div>

            {/* Best HR zones workout */}
            <div
              className="stat-card clickable"
              onClick={openHrModal}
            >
              <div className="stat-value">
                {bestHr ? `${bestHr.hi} min` : "—"}
              </div>
              <div className="stat-label">
                Most minutes in high zones (Z3+Z4+Z5)
              </div>
              {bestHr?.date && (
                <div
                  className="muted"
                  style={{ fontSize: 11, marginTop: 4 }}
                >
                  PB: {fmtUiDate(bestHr.date)}
                </div>
              )}
            </div>

            {/* Weekly volume – nije klikabilan jer se računa iz setova */}
            <div className="stat-card">
              <div className="stat-value">
                {weeklyVolume.length
                  ? `${Math.round(
                      weeklyVolume[weeklyVolume.length - 1].volume
                    )}`
                  : "—"}
              </div>
              <div className="stat-label">
                Last week volume (kg · reps)
              </div>
            </div>
          </div>

          {/* 4) VOLUME GRAF */}
          <div className="card" style={{ marginTop: 10 }}>
            <div className="body">
              <div className="dash-head" style={{ marginBottom: 4 }}>
                <div className="dash-title light">Volume by week</div>
              </div>
              <Sparkline points={volumePoints} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== MODAL: LIFT SET ===== */}
      {modal?.type === "lift" && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                Add set – {liftLabel(liftForm.lift)}{" "}
                <span style={{ fontSize: 13, opacity: 0.8 }}>
                  (per 1RM estimate)
                </span>
              </h3>
              <button className="btn-ghost small" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Date</label>
                <input
                  type="date"
                  className="input"
                  value={liftForm.date}
                  onChange={(e) =>
                    setLiftForm((f) => ({
                      ...f,
                      date: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  value={liftForm.weight}
                  onChange={(e) =>
                    setLiftForm((f) => ({
                      ...f,
                      weight: e.target.value,
                    }))
                  }
                  placeholder="npr. 100"
                />
              </div>
              <div className="form-row">
                <label>Reps</label>
                <input
                  type="number"
                  className="input"
                  value={liftForm.reps}
                  onChange={(e) =>
                    setLiftForm((f) => ({
                      ...f,
                      reps: e.target.value,
                    }))
                  }
                  placeholder="npr. 5"
                />
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                App uses Epley formula to calculate estimated
                1RM using input set (weight × reps). Type in the set you
                have worked on close to the maximum.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost small" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveLiftFromModal}>
                Save set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: FASTEST 5K ===== */}
      {modal?.type === "5k" && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Add 5km run</h3>
              <button className="btn-ghost small" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Date</label>
                <input
                  type="date"
                  className="input"
                  value={fiveKForm.date}
                  onChange={(e) =>
                    setFiveKForm((f) => ({
                      ...f,
                      date: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label>Time (mm:ss)</label>
                <input
                  type="text"
                  className="input"
                  value={fiveKForm.time}
                  onChange={(e) =>
                    setFiveKForm((f) => ({
                      ...f,
                      time: e.target.value,
                    }))
                  }
                  placeholder="e.g. 21:30"
                />
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                E.g. 20:45 presents 20 minutes and 45 seconds. App saves time
                in seconds and shows you the fastest 5 km as your PB.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost small" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveFiveKFromModal}>
                Save result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: HR WORKOUT ===== */}
      {modal?.type === "hr" && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Add HR-zones workout</h3>
              <button className="btn-ghost small" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>Date</label>
                <input
                  type="date"
                  className="input"
                  value={hrForm.date}
                  onChange={(e) =>
                    setHrForm((f) => ({
                      ...f,
                      date: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label>Zone (minutes)</label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 6,
                  }}
                >
                  {["z1", "z2", "z3", "z4", "z5"].map((z) => (
                    <input
                      key={z}
                      type="number"
                      className="input"
                      placeholder={z.toUpperCase()}
                      value={hrForm[z]}
                      onChange={(e) =>
                        setHrForm((f) => ({
                          ...f,
                          [z]: e.target.value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                High zones (Z3+Z4+Z5) are being used as metric of the most intense
                workout. App calculates PB out of them.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost small" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn-primary" onClick={saveHrFromModal}>
                Save trainig
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
