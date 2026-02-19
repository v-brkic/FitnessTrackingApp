// src/store/photosCloud.js
import { getAuth } from "firebase/auth";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot,
  orderBy, query, serverTimestamp, updateDoc
} from "firebase/firestore";

const db = getFirestore();

/** File -> komprimirani JPEG dataURL (maxDim ~1280, quality ~0.72), iOS-safe */
export async function fileToCompressedDataURL(file, { maxDim = 1280, quality = 0.72 } = {}) {
  if (!file) throw new Error("Nije odabran nijedan file.");

  // iOS / HEIC: ako tip nije podržan za decode u <img>, probaj preko FileReader-a (dataURL)
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Ne mogu pročitati sliku (FileReader)."));
    fr.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Ne mogu učitati sliku. Format možda nije podržan (HEIC/HEIF)."));
    // iOS orientation hint (ne utječe na canvas, ali pomaže renderu u nekim slučajevima)
    i.style.imageOrientation = "from-image";
    i.src = dataUrl;
  });

  // pokušaj dekodirati eksplicitno kad je podržano (Chrome/Safari noviji)
  if (img.decode) { try { await img.decode(); } catch {/*noop*/} }

  // dimenzije
  const { width, height } = img;
  const ratio = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * ratio));
  const targetH = Math.max(1, Math.round(height * ratio));

  // canvas
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // kompresija u JPEG
  const MAX_BYTES = 900 * 1024; // sigurnije ispod Firestore ~1MB limita
  const sizeOfB64 = (uri) => {
    const i = uri.indexOf("base64,");
    const b64 = i >= 0 ? uri.slice(i + 7) : uri;
    return Math.floor((b64.length * 3) / 4);
  };

  let q = quality;
  let out = canvas.toDataURL("image/jpeg", q);
  while (sizeOfB64(out) > MAX_BYTES && q > 0.4) {
    q -= 0.08;
    out = canvas.toDataURL("image/jpeg", q);
  }
  if (sizeOfB64(out) > MAX_BYTES) {
    throw new Error("Slika je prevelika i nakon kompresije. Pokušaj s manjom rezolucijom.");
  }

  return {
    dataURL: out,
    width: targetW,
    height: targetH,
    contentType: "image/jpeg",
    approxBytes: sizeOfB64(out),
  };
}

const userPhotosCol = (uid) => collection(db, "users", uid, "progressPhotos");

/** Realtime čitanje (najnovije prve) */
export function subscribeProgressPhotos(setter) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Ne mogu učitati slike: korisnik nije prijavljen.");
  const q = query(userPhotosCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setter(list);
  });
}

/** Dodaj fotku (kompresija + caption) */
export async function addProgressPhotoFromFile(file, { dateIso, caption } = {}) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Ne mogu spremiti sliku: korisnik nije prijavljen.");

  const { dataURL, width, height, contentType, approxBytes } =
    await fileToCompressedDataURL(file);

  const payload = {
    date: dateIso || new Date().toISOString().slice(0, 10),
    caption: caption || "",
    dataURL,
    width,
    height,
    contentType,
    sizeBytes: approxBytes,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(userPhotosCol(uid), payload);
  return { id: ref.id, ...payload };
}

/** Obriši fotku */
export async function deleteProgressPhoto(id) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Ne mogu obrisati sliku: korisnik nije prijavljen.");
  await deleteDoc(doc(db, "users", uid, "progressPhotos", id));
}

/** Uredi opis fotke */
export async function updatePhotoCaption(id, caption) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error("Ne mogu urediti opis: korisnik nije prijavljen.");
  await updateDoc(doc(db, "users", uid, "progressPhotos", id), { caption: caption || "" });
}
