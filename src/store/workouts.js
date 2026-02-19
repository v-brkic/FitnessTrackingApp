// Lokalni storage store za workoute & logove
const KEY = "workouts_v1";
const LOGS_KEY = "workout_logs_v1";

const uid = () => Math.random().toString(36).slice(2, 10);

export function loadWorkouts() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function saveWorkouts(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
export function addWorkout(w) {
  const list = loadWorkouts();
  const toSave = {
    id: uid(),
    name: "",
    imageUrl: "",
    difficulty: 0,
    exercises: [],
    ...w,
  };
  list.push(toSave);
  saveWorkouts(list);
  return toSave;
}
export function getWorkout(id) {
  return loadWorkouts().find(w => w.id === id);
}
export function deleteWorkout(id) {
  const next = loadWorkouts().filter(w => w.id !== id);
  saveWorkouts(next);
  return next;
}
export function updateWorkout(updated) {
  const list = loadWorkouts();
  const i = list.findIndex(w => w.id === updated.id);
  if (i >= 0) {
    list[i] = { ...list[i], ...updated };
    saveWorkouts(list);
    return list[i];
  }
  return null;
}

/** Označi/odznači vježbu kao "gotovo" (persistira u workout.exercises[idx].done) */
export function toggleExerciseDone(workoutId, exIndex) {
  const list = loadWorkouts();
  const i = list.findIndex(w => w.id === workoutId);
  if (i < 0) return null;
  const w = list[i];
  if (!Array.isArray(w.exercises)) w.exercises = [];
  const ex = w.exercises[exIndex];
  if (!ex) return null;
  const done = !Boolean(ex.done);
  w.exercises = w.exercises.map((e, idx) => idx === exIndex ? { ...e, done } : e);
  list[i] = w;
  saveWorkouts(list);
  return { workout: w, done };
}

/** ----- Tjedan / datumi / logovi ----- */
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
export function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
export function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Logovi odrađenih treninga (svaka kvačica = jedan log) */
export function loadLogs() {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); }
  catch { return []; }
}
function saveLogs(list) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(list));
}
export function addLogForWorkout(workout, dateIso) {
  const logs = loadLogs();
  logs.push({ workoutId: workout.id, date: dateIso, exercises: workout.exercises?.length || 0 });
  saveLogs(logs);
  return logs;
}
export function removeLogForWorkoutOnDate(workoutId, dateIso) {
  const logs = loadLogs().filter(l => !(l.workoutId === workoutId && l.date === dateIso));
  saveLogs(logs);
  return logs;
}

/** Zbrojevi za raspon — (koristimo direktno u Home za custom izračun) */
export function aggregateLogs(start, end) {
  const workoutsById = {};
  loadWorkouts().forEach(w => (workoutsById[w.id] = w));
  const logs = loadLogs().filter(l => {
    const d = new Date(`${l.date}T00:00:00`);
    return d >= start && d <= end;
  });
  let workoutsDone = 0;
  let exercisesDone = 0;
  const muscleHits = {};
  logs.forEach(l => {
    const w = workoutsById[l.workoutId];
    if (!w) return;
    workoutsDone += 1;
    const list = Array.isArray(w.exercises) ? w.exercises : [];
    exercisesDone += list.length;
    list.forEach(ex => {
      const g = ex?.group || "Other";
      muscleHits[g] = (muscleHits[g] || 0) + 1;
    });
  });
  const totalHits = Object.values(muscleHits).reduce((a,b)=>a+b,0);
  return { workoutsDone, exercisesDone, muscleHits, totalHits };
}
