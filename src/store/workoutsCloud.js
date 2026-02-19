import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, doc, addDoc, getDoc, onSnapshot,
  deleteDoc, updateDoc, query, where, orderBy, getDocs, serverTimestamp
} from "firebase/firestore";

/* ================= Helpers: datumi ================= */
export function startOfWeek(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (dt.getDay() + 6) % 7; // pon=0
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
export function startOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  dt.setHours(0,0,0,0);
  return dt;
}
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ================= Firestore refs ================= */
const db = getFirestore();
const uidOrThrow = () => {
  const u = getAuth().currentUser;
  if (!u) throw new Error("Not authenticated");
  return u.uid;
};
const workoutsCol = (uid) => collection(db, `users/${uid}/workouts`);
const workoutDoc = (uid, id) => doc(db, `users/${uid}/workouts/${id}`);
const logsCol = (uid) => collection(db, `users/${uid}/logs`);

/* ================= Utils ================= */
function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) out[k] = stripUndefinedDeep(v);
    });
    return out;
  }
  return value;
}
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const numOrNullFloat = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const timeOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/* ================= Workouts ================= */
export function subscribeWorkouts(setter) {
  try {
    const uid = uidOrThrow();
    const q = query(workoutsCol(uid), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setter(arr);
    });
  } catch {
    setter([]);
    return () => {};
  }
}

export async function addWorkout(data) {
  const uid = uidOrThrow();
  const ex = Array.isArray(data.exercises) ? data.exercises.map(e => ({
    name: e?.name || "",
    group: e?.group || "Other",
    sets: numOrNull(e?.sets),
    reps: numOrNull(e?.reps),
    minutes: numOrNull(e?.minutes),
    weight: numOrNullFloat(e?.weight),
    superId: e?.superId ?? null,
    done: !!e?.done,
    doneAt: timeOrNull(e?.doneAt), // ← NOVO
  })) : [];

  const payload = stripUndefinedDeep({
    name: data.name || "",
    imageUrl: data.imageUrl || "",
    difficulty: Number(data.difficulty || 0),
    exercises: ex,
    createdAt: serverTimestamp(),
  });

  const ref = await addDoc(workoutsCol(uid), payload);
  return { id: ref.id, ...payload };
}

export async function deleteWorkout(id) {
  const uid = uidOrThrow();
  await deleteDoc(workoutDoc(uid, id));
}

export function subscribeWorkout(id, setter) {
  try {
    const uid = uidOrThrow();
    return onSnapshot(workoutDoc(uid, id), (snap) => {
      setter(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  } catch {
    setter(null);
    return () => {};
  }
}

export async function getWorkout(id) {
  const uid = uidOrThrow();
  const snap = await getDoc(workoutDoc(uid, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ====== FULL UPDATE: meta + exercises ====== */
export async function updateWorkoutFull(workoutId, data) {
  const uid = uidOrThrow();
  const patch = {};

  if (data.name !== undefined)       patch.name = data.name || "";
  if (data.imageUrl !== undefined)   patch.imageUrl = data.imageUrl || "";
  if (data.difficulty !== undefined) patch.difficulty = Number(data.difficulty || 0);

  if (Array.isArray(data.exercises)) {
    patch.exercises = data.exercises.map(e => ({
      name: e?.name || "",
      group: e?.group || "Other",
      sets: numOrNull(e?.sets),
      reps: numOrNull(e?.reps),
      minutes: numOrNull(e?.minutes),
      weight: numOrNullFloat(e?.weight),
      superId: e?.superId ?? null,
      done: !!e?.done,
      doneAt: timeOrNull(e?.doneAt), // ← NOVO
    }));
  }

  await updateDoc(workoutDoc(uid, workoutId), stripUndefinedDeep(patch));
}

/* ====== Gotovo toggle (zadržano, ali sada piše i doneAt) ====== */
export async function toggleExerciseDone(workoutId, exIndex) {
  const uid = uidOrThrow();
  const ref = workoutDoc(uid, workoutId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const w = { id: snap.id, ...snap.data() };
  const list = Array.isArray(w.exercises) ? [...w.exercises] : [];
  if (!list[exIndex]) return null;

  const was = !!list[exIndex].done;
  list[exIndex] = stripUndefinedDeep({
    ...list[exIndex],
    done: !was,
    doneAt: !was ? Date.now() : null, // kad uključim – postavi timestamp; kad isključim – obriši
  });

  await updateDoc(ref, { exercises: list });
  return { workout: { ...w, exercises: list } };
}

/* ================= Logs ================= */
export function subscribeLogsInRange(start, end, setter) {
  try {
    const uid = uidOrThrow();
    const from = toIsoDate(start);
    const to = toIsoDate(end);
    const qy = query(
      logsCol(uid),
      where("date", ">=", from),
      where("date", "<=", to),
      orderBy("date", "asc")
    );
    return onSnapshot(qy, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setter(arr);
    });
  } catch {
    setter([]);
    return () => {};
  }
}

export async function addLogForWorkout(workout, dateIso) {
  const uid = uidOrThrow();
  await addDoc(logsCol(uid), stripUndefinedDeep({
    workoutId: workout.id,
    date: dateIso,
    createdAt: serverTimestamp(),
  }));
}

export async function removeLogForWorkoutOnDate(workoutId, dateIso) {
  const uid = uidOrThrow();
  const qy = query(
    logsCol(uid),
    where("workoutId", "==", workoutId),
    where("date", "==", dateIso)
  );
  const snap = await getDocs(qy);
  const deletions = [];
  snap.forEach((d) => deletions.push(deleteDoc(doc(db, d.ref.path))));
  await Promise.all(deletions);
}

// ===== Exercise-level logs for stats =====

const exerciseLogsCol = (uid) =>
  collection(db, "users", uid, "exerciseLogs");

/**
 * Subscribe na exercise logove u rasponu datuma [start, end].
 * start / end su JS Date, ali se sprema i filtrira po stringu "YYYY-MM-DD".
 */
export function subscribeExerciseLogsInRange(start, end, setter) {
  try {
    const uid = uidOrThrow();
    const from = toIsoDate(start);
    const to = toIsoDate(end);

    const qy = query(
      exerciseLogsCol(uid),
      where("performedAtDate", ">=", from),
      where("performedAtDate", "<=", to),
      orderBy("performedAtDate", "asc")
    );

    return onSnapshot(qy, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setter(arr);
    });
  } catch (err) {
    console.error("subscribeExerciseLogsInRange error", err);
    setter([]);
    return () => {};
  }
}

/**
 * Dodaje log za jednu odrađenu vježbu.
 * OVO SE POZIVA kada u WorkoutDetails stisneš "Gotovo".
 *
 * - workoutId, workoutName   → koji trening
 * - exerciseIndex            → index vježbe u exercises array-u
 * - exerciseName, group      → naziv, grupa
 * - weight, sets, reps, minutes → brojke za računanje intenziteta
 * - performedAt              → Date (ili bilo što što new Date() može pojest)
 */
export async function addExerciseLog({
  workoutId,
  workoutName,
  exerciseIndex,
  exerciseName,
  group,
  weight,
  sets,
  reps,
  minutes,
  performedAt,
}) {
  const uid = uidOrThrow();
  const dt =
    performedAt instanceof Date ? performedAt : new Date(performedAt || Date.now());
  const dayIso = toIsoDate(dt);

  const payload = {
    workoutId,
    workoutName: workoutName || "",
    exerciseIndex:
      typeof exerciseIndex === "number" ? exerciseIndex : null,
    exerciseName: exerciseName || "",
    group: group || "Other",
    weight:
      typeof weight === "number"
        ? weight
        : weight != null
        ? Number(weight)
        : null,
    sets:
      typeof sets === "number"
        ? sets
        : sets != null
        ? Number(sets)
        : null,
    reps:
      typeof reps === "number"
        ? reps
        : reps != null
        ? Number(reps)
        : null,
    minutes:
      typeof minutes === "number"
        ? minutes
        : minutes != null
        ? Number(minutes)
        : null,
    performedAt: dt,
    performedAtDate: dayIso,
    createdAt: serverTimestamp(),
  };

  await addDoc(exerciseLogsCol(uid), payload);
}
