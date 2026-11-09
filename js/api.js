// Lớp truy cập Firestore DÙNG CHUNG cho tao-qr.html và tram-can.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, addDoc, deleteDoc, writeBatch, serverTimestamp,
  query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, EMP_COLLECTION, SAVE_COLLECTION } from "./firebase-config.js";

const db = getFirestore(initializeApp(firebaseConfig));

/* ---------- Nhân viên ---------- */
export function subscribeEmployees(onData, onErr) {
  return onSnapshot(collection(db, EMP_COLLECTION),
    s => onData(s.docs.map(d => ({ code: d.id, ...d.data() }))), onErr);
}

export async function saveEmployees(list) {
  for (let i = 0; i < list.length; i += 400) {     // mỗi batch tối đa 500 thao tác
    const b = writeBatch(db);
    list.slice(i, i + 400).forEach(e => b.set(doc(db, EMP_COLLECTION, e.code),
      { code: e.code, name: e.name, dept: e.dept || '', updatedAt: serverTimestamp() }, { merge: true }));
    await b.commit();
  }
}

export const removeEmployee = code => deleteDoc(doc(db, EMP_COLLECTION, code));

export async function getEmployee(code) {
  const s = await getDoc(doc(db, EMP_COLLECTION, code));
  return s.exists() ? { code: s.id, ...s.data() } : null;
}

/* ---------- Lượt cân ---------- */
export const addWeighing = rec => addDoc(collection(db, SAVE_COLLECTION), { ...rec, createdAt: serverTimestamp() });

export function subscribeWeighings(max, onData, onErr) {
  return onSnapshot(query(collection(db, SAVE_COLLECTION), orderBy('createdAt', 'desc'), limit(max)),
    s => onData(s.docs.map(d => { const x = d.data();
      return { id: d.id, ...x, time: x.createdAt ? x.createdAt.toDate().toLocaleTimeString('vi-VN') : '...' }; })),
    onErr);
}
