// src/store/pbsCloud.js
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const db = getFirestore();

/* Helper: uvijek vrati Timestamp */
const asTS = (v) =>
  v instanceof Timestamp
    ? v
    : v instanceof Date
    ? Timestamp.fromDate(v)
    : typeof v === "string"
    ? Timestamp.fromDate(new Date(v))
    : Timestamp.fromDate(new Date());

/* Helper: TS od (danas - days) */
const nowMinusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - (days || 365));
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

/* Helper: sigurno pretvori date field u JS Date */
const toDateSafe = (val) => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (val instanceof Timestamp) return val.toDate();
  if (val.toDate) return val.toDate();
  return new Date(val);
};

// ------------ LIFT SETS (za procjenu 1RM) ------------
// 🔧 NOVO: čitamo sve setove za korisnika, filtriramo po lift + periodu u JS
export function onLiftSets({ lift, days = 90 }, cb) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return () => {};

  const col = collection(db, "users", uid, "liftSets");
  const qy = query(col, orderBy("date", "asc")); // SAMO orderBy, bez where

  const fromTs = nowMinusDays(days);
  const fromMs = fromTs.toDate().getTime();
  const liftKey = (lift || "").toLowerCase();

  return onSnapshot(
    qy,
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const filtered = all.filter((row) => {
        const rowLift = String(row.lift || "").toLowerCase();
        if (liftKey && rowLift !== liftKey) return false;

        const dt = toDateSafe(row.date);
        return dt.getTime() >= fromMs;
      });

      cb(filtered);
    },
    (err) => {
      console.error("onLiftSets error:", err);
      cb([]);
    }
  );
}

export async function addLiftSet({ lift, weight, reps, date }) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  const col = collection(db, "users", uid, "liftSets");
  return addDoc(col, {
    lift: (lift || "").toLowerCase(),
    weight: Number(weight || 0),
    reps: Number(reps || 1),
    date: asTS(date),
    createdAt: serverTimestamp(),
  });
}

export async function deleteLiftSet(id) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !id) return;
  await deleteDoc(doc(db, "users", uid, "liftSets", id));
}

// ------------ 5K (PB) ------------
// ovo može ostati relativno jednostavno; ali dodajemo error handler
export function onFiveK({ days = 365 }, cb) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return () => {};
  const col = collection(db, "users", uid, "fiveK");

  // range + orderBy na istom polju ("date") → OK bez custom indexa
  const qy = query(
    col,
    where("date", ">=", nowMinusDays(days)),
    orderBy("date", "asc")
  );

  return onSnapshot(
    qy,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error("onFiveK error:", err);
      cb([]);
    }
  );
}

export async function addFiveK({ seconds, date }) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  const col = collection(db, "users", uid, "fiveK");
  return addDoc(col, {
    seconds: Number(seconds || 0),
    date: asTS(date),
    createdAt: serverTimestamp(),
  });
}

export async function deleteFiveK(id) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !id) return;
  await deleteDoc(doc(db, "users", uid, "fiveK", id));
}

// ------------ HR ZONES workout (najbolji) ------------
// isto kao i 5K – range + orderBy na istom polju
export function onHrWorkouts({ days = 180 }, cb) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return () => {};
  const col = collection(db, "users", uid, "hrWorkouts");

  const qy = query(
    col,
    where("date", ">=", nowMinusDays(days)),
    orderBy("date", "asc")
  );

  return onSnapshot(
    qy,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error("onHrWorkouts error:", err);
      cb([]);
    }
  );
}

export async function addHrWorkout({ z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0, date }) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  const col = collection(db, "users", uid, "hrWorkouts");

  const Z1 = Number(z1 || 0);
  const Z2 = Number(z2 || 0);
  const Z3 = Number(z3 || 0);
  const Z4 = Number(z4 || 0);
  const Z5 = Number(z5 || 0);

  return addDoc(col, {
    z1: Z1,
    z2: Z2,
    z3: Z3,
    z4: Z4,
    z5: Z5,
    hi: Z3 + Z4 + Z5, // “visoki” zone
    date: asTS(date),
    createdAt: serverTimestamp(),
  });
}

export async function deleteHrWorkout(id) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !id) return;
  await deleteDoc(doc(db, "users", uid, "hrWorkouts", id));
}

// ------------ Helpers ------------
export const epley1RM = (w, r) => Number(w) * (1 + Number(r) / 30);

/**
 * Volumen po tjednima:
 * zbraja weight * reps po ISO-tjednu (pon–ned).
 */
export function groupWeeklyVolume(sets) {
  const toMonday = (d) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 0 = pon
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const key = (dt) => toMonday(dt).toISOString().slice(0, 10);

  const out = {};
  (sets || []).forEach((s) => {
    const dt = toDateSafe(s.date);
    const k = key(dt);
    out[k] =
      (out[k] || 0) +
      Number(s.weight || 0) * Number(s.reps || 0);
  });

  return Object.entries(out)
    .map(([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => weekStartCompare(a.weekStart, b.weekStart));
}

// helper za sort datuma u stringu "YYYY-MM-DD"
function weekStartCompare(a, b) {
  return a.localeCompare(b);
}

export const mmssToSeconds = (t) => {
  if (typeof t === "number") return t;
  if (!t) return 0;
  const parts = String(t)
    .trim()
    .split(":")
    .map((n) => Number(n));
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3)
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number(t) || 0;
};

export const secondsToMmSs = (s) => {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};
