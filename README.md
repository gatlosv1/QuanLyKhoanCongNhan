# QuanLyKhoanCongNhan

Phần mềm quản lý khoán công nhân: tạo mã QR cho nhân viên, quét QR và cân tại trạm cân, lưu lịch sử cân lên Firestore, có đăng nhập và phân quyền.

## Cấu trúc

| Đường dẫn | Mô tả |
|---|---|
| `index.html` | Trang gốc, chuyển hướng tới `html/index.html` (dùng cho GitHub Pages) |
| `html/index.html` | Đăng nhập, quản lý tài khoản |
| `html/tao-qr.html` | Tạo mã QR nhân viên |
| `html/tram-can.html` | Trạm cân: quét nhân viên, đọc cân, lưu Firestore |
| `js/` | Mã JavaScript (`firebase-config.js`, `api.js`, `login.js`, `tao-qr.js`, `tram-can.js`) |
| `css/style.css` | Giao diện |
| `firestore.rules` | Quy tắc bảo mật Firestore |
| `nội dung/` | Ghi chú nội dung và dữ liệu bổ sung |

## Cấu hình Git / GitHub

Repository: https://github.com/gatlosv1/QuanLyKhoanCongNhan.git

Khởi tạo và đẩy lần đầu:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/gatlosv1/QuanLyKhoanCongNhan.git
git push -u origin main
```

Nếu `origin` đã tồn tại, đổi địa chỉ thay vì thêm mới:

```bash
git remote set-url origin https://github.com/gatlosv1/QuanLyKhoanCongNhan.git
git branch -M main
git push -u origin main
```

## Cấu hình Firebase

Cấu hình dùng chung nằm trong `js/firebase-config.js`, gồm các collection Firestore:

- `employees`: nhân viên (doc id = mã QR, trường `name`)
- `weighings`: lịch sử cân
- `users`: hồ sơ và quyền (doc id = uid Firebase Auth)
- `meta`: doc `setup` đánh dấu đã tạo admin đầu tiên

Tên đăng nhập được đổi thành email nội bộ với tên miền `khoancn.local`. Triển khai `firestore.rules` lên Firebase để bảo vệ dữ liệu.
