// Cấu hình Firebase DÙNG CHUNG cho tao-qr.html và tram-can.html
export const firebaseConfig = {
  apiKey: "AIzaSyB-ySP9D11LpJjg3k_Ga9FozBRlxG2QgpM",
  authDomain: "quetqrornhancan.firebaseapp.com",
  databaseURL: "https://quetqrornhancan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quetqrornhancan",
  storageBucket: "quetqrornhancan.firebasestorage.app",
  messagingSenderId: "78498905168",
  appId: "1:78498905168:web:4219fa3ba2249abb83e555",
  measurementId: "G-9GEMTL1CM9"
};

// Tên collection Firestore dùng chung
export const EMP_COLLECTION = "employees";    // doc id = mã QR, field "name"
export const SAVE_COLLECTION = "weighings";   // lịch sử cân
export const USER_COLLECTION = "users";       // hồ sơ + quyền (doc id = uid Firebase Auth)
export const META_COLLECTION = "meta";        // doc "setup" đánh dấu đã tạo admin đầu tiên
export const EMAIL_DOMAIN = "khoancn.local";  // tên đăng nhập -> email nội bộ
