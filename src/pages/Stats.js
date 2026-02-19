// src/pages/Stats.js
import React, { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";
import { subscribeWorkouts, subscribeExerciseLogsInRange } from "../store/workoutsCloud";

/* lokalni datumski helperi – bez ovisnosti */
const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
};

// ✅ FIX: prepoznaj performedAtDate (YYYY-MM-DD)
const dayKeyFromLog = (lg) => {
  const src =
    lg?.performedAtDate || // ✅ added
    lg?.performedAt ||
    lg?.date ||
    lg?.performedDate ||
    lg?.day ||
    null;

  if (!src) return "";

  // ako je already "YYYY-MM-DD"
  if (typeof src === "string" && /^\d{4}-\d{2}-\d{2}$/.test(src)) return src;

  let dt = null;
  try {
    if (src.toDate && typeof src.toDate === "function") {
      dt = src.toDate(); // Firestore Timestamp
    } else if (typeof src === "number") {
      dt = new Date(src); // ms
    } else {
      dt = new Date(src); // string / Date
    }
  } catch {
    return "";
  }
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};

const formatNumber = (n) => (n > 9999 ? Math.round(n / 1000) + "k" : Math.round(n));

export default function Stats() {
  const [workouts, setWorkouts] = useState([]);
  useEffect(() => {
    const unsub = subscribeWorkouts(setWorkouts);
    return () => unsub && unsub();
  }, []);

  const [mode, setMode] = useState("week"); // "week" | "month"

  // ✅ week range je već Mon..Sun (0..6) — to je ono što treba za Sat/Sun
  const dateFrom = useMemo(
    () => (mode === "week" ? startOfWeek(new Date()) : startOfMonth(new Date())),
    [mode]
  );
  const dateTo = useMemo(
    () => (mode === "week" ? addDays(startOfWeek(new Date()), 6) : endOfMonth(new Date())),
    [mode]
  );

  const [logs, setLogs] = useState([]);
  useEffect(() => {
    const unsub = subscribeExerciseLogsInRange(dateFrom, dateTo, setLogs);
    return () => unsub && unsub();
  }, [dateFrom, dateTo]);

  const byId = useMemo(() => {
    const m = new Map();
    workouts.forEach((w) => m.set(w.id, w));
    return m;
  }, [workouts]);

  const stats = useMemo(() => {
    if (!logs.length) {
      return {
        workoutsDone: 0,
        totalExercises: 0,
        volume: 0,
        muscleGroups: [],
        strengthCount: 0,
        conditioningCount: 0,
      };
    }

    const sessionSet = new Set(); // unique (workoutId + day)
    let totalExercises = 0;
    let volume = 0;
    const groupMap = new Map();
    let strengthCount = 0;
    let conditioningCount = 0;

    for (const lg of logs) {
      const w = byId.get(lg.workoutId);
      if (!w || !Array.isArray(w.exercises)) continue;

      const exIndex = typeof lg.exerciseIndex === "number" ? lg.exerciseIndex : 0;
      const ex = w.exercises[exIndex];
      if (!ex) continue;

      const dayKey = dayKeyFromLog(lg);
      if (dayKey) sessionSet.add(`${lg.workoutId}__${dayKey}`);

      totalExercises += 1;

      const sets = ex.sets != null ? Number(ex.sets) || 1 : 1;
      const reps = ex.reps != null ? Number(ex.reps) || 1 : 1;
      const weight = ex.weight != null ? Number(ex.weight) || 0 : 0;

      volume += Math.max(0, weight * reps * sets);

      const g = ex.group || "Other";
      groupMap.set(g, (groupMap.get(g) || 0) + 1);

      const gLower = String(g).toLowerCase();
      if (gLower === "cardio" || gLower === "mobility") conditioningCount += 1;
      else strengthCount += 1;
    }

    const muscleGroups = Array.from(groupMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    return {
      workoutsDone: sessionSet.size,
      totalExercises,
      volume,
      muscleGroups,
      strengthCount,
      conditioningCount,
    };
  }, [logs, byId]);

  const perSessionVolume = stats.workoutsDone > 0 ? stats.volume / stats.workoutsDone : 0;

  const intensityLabel = useMemo(() => {
    if (!stats.volume || !stats.workoutsDone) return "Low";
    if (perSessionVolume < 5000) return "Low";
    if (perSessionVolume < 15000) return "Medium";
    return "High";
  }, [stats.volume, stats.workoutsDone, perSessionVolume]);

  const periodLabel = mode === "week" ? "weekly" : "monthly";
  const avgPerSession = stats.workoutsDone > 0 ? (stats.totalExercises / stats.workoutsDone).toFixed(1) : "0.0";

  const totalSplit = stats.strengthCount + stats.conditioningCount || 1;
  const percStrength = (stats.strengthCount / totalSplit) * 100;
  const percCond = (stats.conditioningCount / totalSplit) * 100;

  // ✅ helper: counts per muscle group name (case-insensitive)
  const groupCountMap = useMemo(() => {
    const m = new Map();
    for (const g of stats.muscleGroups || []) {
      m.set(String(g.name || "other").toLowerCase(), Number(g.count) || 0);
    }
    return m;
  }, [stats.muscleGroups]);

  const cnt = (name) => groupCountMap.get(String(name).toLowerCase()) || 0;

  // ✅ dynamic "fun" tips for Training split
  const splitTips = useMemo(() => {
    if (!stats.totalExercises) return [];

    const core = cnt("core");
    const mobility = cnt("mobility");
    const cardio = cnt("cardio");
    const legs = cnt("legs");
    const glutes = cnt("glutes");
    const back = cnt("back");
    const chest = cnt("chest");
    const shoulders = cnt("shoulders");

    const distinctGroups = (stats.muscleGroups || []).length;
    const tips = [];

    // Definitions (always useful)
    tips.push({
      key: "def-strength",
      text: `✅ Strength: every group except Cardio & Mobility`,
    });
    tips.push({
      key: "def-cond",
      text: `💙 Cardio/Mobility: only exercises in Cardio or Mobility groups`,
    });

    // Missing groups (only show if really 0)
    if (core === 0) tips.push({ key: "miss-core", text: `🧠 No Core logged — add 1–2 quick sets for stability.` });
    if (mobility === 0) tips.push({ key: "miss-mob", text: `🧘 No Mobility logged — a 5–10 min cooldown goes a long way.` });
    if (cardio === 0 && stats.conditioningCount === 0)
      tips.push({ key: "miss-cardio", text: `🏃 No Cardio logged — even a short Zone 2 session counts.` });

    // Balance feedback
    if (stats.strengthCount > 0 && stats.conditioningCount > 0) {
      tips.push({ key: "balance-ok", text: `⚖️ Nice balance — you mixed strength with conditioning.` });
    } else if (stats.strengthCount > 0 && stats.conditioningCount === 0) {
      tips.push({ key: "balance-strength-only", text: `🏋️ Strength-only period — consider adding a bit of mobility/cardio.` });
    } else if (stats.strengthCount === 0 && stats.conditioningCount > 0) {
      tips.push({ key: "balance-cond-only", text: `💨 Conditioning-only period — sprinkle in strength to keep muscle.` });
    }

    // Intensity-based message
    if (intensityLabel === "High") {
      tips.push({ key: "int-high", text: `🔥 High intensity — prioritize sleep and recovery this ${periodLabel}.` });
    } else if (intensityLabel === "Medium") {
      tips.push({ key: "int-med", text: `✅ Solid intensity — keep consistency and progress will stack up.` });
    } else {
      tips.push({ key: "int-low", text: `🌱 Low intensity — great for a deload; add load if this wasn’t planned.` });
    }

    // Variety / “coverage”
    if (distinctGroups >= 6) tips.push({ key: "variety-high", text: `Great variety — you hit ${distinctGroups} muscle groups.` });
    else if (distinctGroups <= 2) tips.push({ key: "variety-low", text: `🎯 Very focused block — only ${distinctGroups} muscle groups hit.` });

    // “Big blocks” highlights (only if notable)
    const lowerBody = legs + glutes;
    if (lowerBody >= Math.max(6, Math.round(stats.totalExercises * 0.35))) {
      tips.push({ key: "lowerbody", text: `🦵 Lower-body heavy — legs & glutes got a lot of love.` });
    }
    const upperPush = chest + shoulders;
    if (upperPush >= Math.max(5, Math.round(stats.totalExercises * 0.3))) {
      tips.push({ key: "push", text: `🧱 Push emphasis — chest/shoulders were a main focus.` });
    }
    if (back >= Math.max(4, Math.round(stats.totalExercises * 0.25))) {
      tips.push({ key: "pull", text: `🪝 Pull emphasis — back work is strong this ${periodLabel}.` });
    }

    // Keep it clean (avoid a wall of chips)
    return tips.slice(0, 8);
  }, [
    stats.totalExercises,
    stats.muscleGroups,
    stats.strengthCount,
    stats.conditioningCount,
    intensityLabel,
    periodLabel,
    groupCountMap,
  ]);

  return (
    <>
      <div className="container page narrow">
        <div className="dash-head">
          <h2 className="dash-title light">
            Stats <span>{mode === "week" ? "(weekly)" : "(monthly)"}</span>
          </h2>
          <div className="dash-switch">
            <button className={`chip ${mode === "week" ? "active" : ""}`} onClick={() => setMode("week")}>
              Week
            </button>
            <button className={`chip ${mode === "month" ? "active" : ""}`} onClick={() => setMode("month")}>
              Month
            </button>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 12 }}>
          <div className="stat-card">
            <div className="stat-value">{stats.workoutsDone}</div>
            <div className="stat-label">Active training days</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Number of days with at least one completed workout.
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{stats.totalExercises}</div>
            <div className="stat-label">Completed exercises</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Every tap on <b>✓ Done</b>. Average: <b>{avgPerSession}</b> per workout.
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-value">{intensityLabel}</div>
            <div className="stat-label">
              {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} intensity
            </div>

            <div style={{ marginTop: 6, display: "flex", gap: 4, fontSize: 10, alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  borderRadius: 999,
                  overflow: "hidden",
                  height: 8,
                  background: "rgba(148,163,184,0.2)",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    opacity: intensityLabel === "Low" ? 1 : 0.4,
                    background: "linear-gradient(90deg, #22c55e, rgba(34,197,94,0.4))",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    opacity: intensityLabel === "Medium" ? 1 : 0.4,
                    background: "linear-gradient(90deg, #eab308, rgba(234,179,8,0.4))",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    opacity: intensityLabel === "High" ? 1 : 0.4,
                    background: "linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4))",
                  }}
                />
              </div>
              <span className="muted" style={{ whiteSpace: "nowrap" }}>
                {formatNumber(stats.volume)} tonnage
              </span>
            </div>

            {stats.workoutsDone > 0 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                ~ <b>{formatNumber(perSessionVolume)}</b> per workout
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="body">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Muscle group hits
            </h3>
            {stats.muscleGroups.length === 0 ? (
              <div className="muted">No data in the selected period.</div>
            ) : (
              <ul className="detail-list">
                {stats.muscleGroups.map((g) => (
                  <li key={g.name} className="detail-row">
                    <span>{g.name}</span>
                    <strong>{g.count}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="body">
            <h3 className="section-title" style={{ marginTop: 0 }}>
              Training split
            </h3>

            {stats.totalExercises === 0 ? (
              <div className="muted">No completed exercises in this period.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      overflow: "hidden",
                      height: 10,
                      background: "rgba(15,23,42,0.7)",
                      display: "flex",
                    }}
                  >
                    <div
                      style={{
                        width: `${percStrength}%`,
                        background: "linear-gradient(90deg, #22c55e, #4ade80)",
                        transition: "width 0.3s ease",
                      }}
                    />
                    <div
                      style={{
                        width: `${percCond}%`,
                        background: "linear-gradient(90deg, #38bdf8, #0ea5e9)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                {/* ✅ dynamic messages */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                  {splitTips.map((t) => (
                    <span key={t.key} className="chip" style={{ padding: "4px 10px", cursor: "default" }}>
                      {t.text}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
