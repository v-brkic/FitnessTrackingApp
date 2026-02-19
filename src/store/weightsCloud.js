// src/store/weightsCloud.js
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection, doc, addDoc, deleteDoc, updateDoc,
  onSnapshot, query, orderBy,
  serverTimestamp, getDocsFromServer,
  Timestamp
} from "firebase/firestore";

const db = getFirestore();

// --- Normalizacija: prihvati različita imena polja i tipove datuma ---
const weightConverter = {
  toFirestore(w) {
    // očekujemo { kg: number, date: Date | Timestamp }
    const dateField = w.date instanceof Date ? Timestamp.fromDate(w.date) :
                      w.date instanceof Timestamp ? w.date : Timestamp.fromDate(new Date());
    return {
      kg: Number(w.kg),
      date: dateField,
      createdAt: serverTimestamp(),
    };
  },
  fromFirestore(snap) {
    const d = snap.data();
    // kg može biti d.kg ili staro d.weight
    let kg = d.kg;
    if (typeof kg !== "number") kg = typeof d.weight === "number" ? d.weight : Number(kg ?? d.weight ?? 0);

    // date može biti Timestamp (idealno), ili string (date/dateIso), ili fallback na createdAt
    let date;
    if (d.date && typeof d.date.toDate === "function") {
      date = d.date.toDate();
    } else if (typeof d.date === "string") {
      date = new Date(d.date);
    } else if (typeof d.dateIso === "string") {
      date = new Date(d.dateIso);
    } else if (d.createdAt && typeof d.createdAt.toDate === "function") {
      date = d.createdAt.toDate();
    } else {
      date = new Date();
    }

    return { id: snap.id, kg: Number(kg), date, _raw: d };
  },
};

const weightsCol = (uid) =>
  collection(db, "users", uid, "weights").withConverter(weightConverter);

// --- SUBSCRIBE: server-first pa live snapshot (rješava “stare podatke” u PWA-u) ---
export function subscribeWeights(onChange) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return () => {};

  const q = query(weightsCol(uid), orderBy("date", "asc"));

  // 1) prvo forsiraj server da pregazi lokalni cache
  getDocsFromServer(q)
    .then((snap) => {
      const rows = snap.docs.map((d) => d.data());
      onChange(rows);
    })
    .catch(() => {
      // offline? preskačemo – onSnapshot će svejedno raditi
    });

  // 2) live stream (uklj. promjene s weba)
  const unsub = onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => d.data());
    onChange(rows);
  });

  return unsub;
}

// --- CREATE ---
export async function addWeight({ kg, date }) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  const data = {
    kg: Number(kg),
    date: date instanceof Date ? Timestamp.fromDate(date) : (
      typeof date === "string" ? Timestamp.fromDate(new Date(date)) : Timestamp.fromDate(new Date())
    ),
    createdAt: serverTimestamp(),
  };
  await addDoc(weightsCol(uid), data);
}

// --- UPDATE (opcionalno, ako trebaš edit unosa) ---
export async function updateWeight(id, patch) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !id) return;
  const ref = doc(db, "users", uid, "weights", id).withConverter(weightConverter);
  const out = {};
  if (patch.kg != null) out.kg = Number(patch.kg);
  if (patch.date != null) {
    out.date = patch.date instanceof Date ? Timestamp.fromDate(patch.date)
      : (patch.date instanceof Timestamp ? patch.date : Timestamp.fromDate(new Date(patch.date)));
  }
  await updateDoc(ref, out);
}

// --- DELETE ---
export async function deleteWeight(id) {
  const uid = getAuth().currentUser?.uid;
  if (!uid || !id) return;
  await deleteDoc(doc(db, "users", uid, "weights", id));
}
