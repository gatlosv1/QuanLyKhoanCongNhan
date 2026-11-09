// Lớp truy cập Firebase (Firestore + Authentication) DÙNG CHUNG cho các trang
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  serverTimestamp, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig, EMP_COLLECTION, SAVE_COLLECTION, USER_COLLECTION, META_COLLECTION, EMAIL_DOMAIN }
  from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const secondary = initializeApp(firebaseConfig, 'secondary');   // tạo tài khoản mà không làm admin bị đăng xuất

/* ---------- Đăng nhập & phân quyền ---------- */
export const ROLES = { admin: 'Quản trị (admin)', user: 'Nhân viên trạm cân' };
export const validUsername = u => /^[a-z0-9._-]{3,30}$/.test(u) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u);
const toEmail = u => { u = u.trim().toLowerCase(); return u.includes('@') ? u : `${u}@${EMAIL_DOMAIN}`; };

export const login = (username, password) => signInWithEmailAndPassword(auth, toEmail(username), password);
export const logout = () => signOut(auth);

export async function getProfile(uid) {
  const s = await getDoc(doc(db, USER_COLLECTION, uid));
  return s.exists() ? { uid, ...s.data() } : null;
}

// Trả về hồ sơ người đang đăng nhập (null nếu chưa đăng nhập hoặc chưa được cấp quyền)
export function currentUser() {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, async u => {
      off();
      if (!u) return resolve(null);
      try { resolve(await getProfile(u.uid)); } catch (e) { resolve(null); }
    });
  });
}

// Chặn trang: chưa đăng nhập -> về index.html; sai quyền -> về trạm cân
export async function requireUser(role) {
  const me = await currentUser();
  if (!me) { location.replace('index.html'); return new Promise(() => {}); }
  if (role && me.role !== role) { location.replace('tram-can.html'); return new Promise(() => {}); }
  return me;
}

export async function isSetupDone() {
  try { return (await getDoc(doc(db, META_COLLECTION, 'setup'))).exists(); } catch (e) { return true; }
}

// Lần đầu: tạo tài khoản admin đầu tiên (chỉ làm được khi chưa có admin nào)
export async function setupFirstAdmin(username, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, toEmail(username), password);
  try {
    const b = writeBatch(db);
    b.set(doc(db, META_COLLECTION, 'setup'), { createdAt: serverTimestamp() });
    b.set(doc(db, USER_COLLECTION, cred.user.uid),
      { username: username.trim().toLowerCase(), name: name || username, role: 'admin', createdAt: serverTimestamp() });
    await b.commit();
  } catch (e) { await cred.user.delete().catch(() => {}); throw e; }
}

/* ---------- Quản lý tài khoản (admin) ---------- */
export async function createAccount({ username, password, name, role }) {
  const sec = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(sec, toEmail(username), password);
  try {
    await setDoc(doc(db, USER_COLLECTION, cred.user.uid),
      { username: username.trim().toLowerCase(), name: name || username, role, createdAt: serverTimestamp() });
  } finally { await signOut(sec); }
}

export const subscribeUsers = (onData, onErr) => onSnapshot(collection(db, USER_COLLECTION),
  s => onData(s.docs.map(d => ({ uid: d.id, ...d.data() }))), onErr);
export const setUserRole = (uid, role) => updateDoc(doc(db, USER_COLLECTION, uid), { role });
export const removeUser = uid => deleteDoc(doc(db, USER_COLLECTION, uid));

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
export const deleteWeighing = id => deleteDoc(doc(db, SAVE_COLLECTION, id));

export async function clearWeighings() {
  const snap = await getDocs(collection(db, SAVE_COLLECTION));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
    await b.commit();
  }
  return snap.size;
}

export function subscribeWeighings(max, onData, onErr) {
  return onSnapshot(query(collection(db, SAVE_COLLECTION), orderBy('createdAt', 'desc'), limit(max)),
    s => onData(s.docs.map(d => { const x = d.data();
      return { id: d.id, ...x, time: x.createdAt ? x.createdAt.toDate().toLocaleTimeString('vi-VN') : '...' }; })),
    onErr);
}
