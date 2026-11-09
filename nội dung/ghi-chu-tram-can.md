# Ghi chú nội dung file tram-can.html
Trạm cân và quét nhân viên: Tailwind CSS, Alpine.js và Firestore.

## 1. Cấu trúc chung

- Một file HTML duy nhất, giao diện bằng **Tailwind CSS**, logic hiển thị bằng **Alpine.js**.
- Phần giao tiếp phần cứng (camera, súng quét, cân) và Firestore viết bằng JavaScript thuần, gán kết quả vào biến Alpine để màn hình tự cập nhật.
- Firebase được nạp bằng module từ CDN của Google, Alpine được nạp sau cùng để hàm điều khiển trang đã sẵn sàng.

## 2. Giao diện

- **Thanh đầu trang:** 3 đèn trạng thái cho Camera, Cân, Firestore (xanh là đang hoạt động).
- **Thanh thông báo lớn** ở giữa, đổi màu theo tình huống: xám là sẵn sàng, vàng là đang chờ thông tin còn thiếu, xanh là đã lưu, đỏ là lỗi.
- **Khối 1, quét nhân viên:** khung camera, nút bật/tắt và đổi camera, ô hiện nhân viên đã nhận.
- **Khối 2, cân:** số cân trực tiếp cỡ lớn, nhãn Ổn định/Đang dao động, ô hiện khối lượng đã nhận, nút nối cân và nút hủy.
- **Phần test:** ô nhập số để giả lập cân khi chưa có cân thật.
- **Bảng cuối trang:** 10 lần lưu gần nhất, tự cập nhật theo thời gian thực từ Firestore.

## 3. Cấu hình ở đầu phần script

- `firebaseConfig`: chỗ dán thông tin dự án Firebase.
- `minWeight`: dưới mức này coi như chưa có hàng.
- `zeroBelow`: cân phải về dưới mức này mới nhận hàng kế tiếp.
- `expireSec`: thời gian chờ tối đa khi mới có một trong hai thông tin.
- Tên hai collection: `employees` (danh sách nhân viên) và `weighings` (kết quả cân).

## 4. Quét nhân viên

- **Camera:** dùng thư viện html5-qrcode, tự bật khi mở trang, có nút đổi camera, quét liên tục.
- **Súng quét:** nghe bàn phím toàn trang. Ký tự đến cách nhau dưới 100ms rồi có Enter thì coi là mã quét. Nhờ vậy không cần bấm vào ô nào và không lẫn với người gõ tay.
- **Chống quét trùng:** cùng một mã trong 3 giây thì bỏ qua.
- **Tra tên:** lấy mã đi tìm trong collection `employees`. Có thì lấy tên, không có hoặc mất mạng thì dùng chính mã làm tên.

## 5. Nhận số cân

- Nối cân qua **Web Serial** (Chrome/Edge). Tốc độ mặc định 9600, đổi theo cân thực tế.
- Đọc từng dòng dữ liệu, tách số và đơn vị (kg hoặc g, g sẽ đổi sang kg).
- Xác định ổn định: chuỗi có `ST` là ổn định, có `US` là chưa ổn định. Nếu cân không gửi cờ nào thì coi là ổn định khi số giữ nguyên khoảng 5 lần đọc liên tiếp.
- Chỉ chốt khối lượng khi cân **ổn định** và lớn hơn mức tối thiểu. Số đã chốt được giữ nguyên, không đổi theo dao động sau đó.

## 6. Logic "đủ 2 thông tin mới lưu"

- Quét nhân viên và đặt cân **không cần theo thứ tự**.
- Sau mỗi lần nhận thêm thông tin, trang kiểm tra:
  - Có đủ nhân viên và khối lượng thì lưu ngay.
  - Mới có cân thì báo vàng "PHẢI QUÉT NHÂN VIÊN".
  - Mới có nhân viên thì báo vàng "hãy đặt hàng lên cân".
  - Quá thời gian chờ mà vẫn thiếu thì tự hủy và đưa trang về trạng thái sẵn sàng.
- Nút **Hủy nhận** để xóa thủ công khi nhận nhầm.

## 7. Lưu Firestore

- Mỗi lần lưu thêm một bản ghi vào `weighings` gồm: mã nhân viên, tên, khối lượng, đơn vị, nguồn quét (camera hoặc súng), thời gian do máy chủ ghi.
- Lưu thành công thì báo xanh, phát tiếng bíp cao, rồi xóa thông tin để chờ lượt mới.
- Lưu lỗi thì báo đỏ, phát tiếng bíp thấp.
- Có khóa trạng thái đang lưu để tránh nhận thêm mã trong lúc ghi.

## 8. Chống lưu trùng

Sau khi lưu, trang đòi **nhấc hàng xuống** (cân về gần 0) mới nhận số cân tiếp theo. Nếu không, hàng vẫn nằm trên cân sẽ bị lưu lặp lại.

## 9. Âm thanh

Bíp trung (nhận nhân viên), bíp trầm (nhận cân), bíp cao (lưu xong), bíp thấp (lỗi), tạo bằng Web Audio, không cần file âm thanh.

## 10. Việc cần làm khi triển khai

1. Dán `firebaseConfig`.
2. Tạo collection `employees` (id là mã QR, trường `name`).
3. Đặt rules Firestore cho phép ghi vào `weighings`.
4. Chạy trên **HTTPS** và dùng Chrome/Edge.
5. Chỉnh tốc độ cổng COM, và cách đọc chuỗi nếu cân trả về định dạng khác.

## 11. Những phần chưa làm (có thể bổ sung sau)

- Đăng nhập/phân quyền (hiện chạy thử nên rules đang mở).
- Xuất Excel/CSV.
- Cảnh báo khối lượng bất thường.
- Sửa/xóa bản ghi trên trang.
- Lưu tạm khi mất mạng rồi đồng bộ sau (Firestore có sẵn cơ chế offline, nhưng chưa bật cấu hình riêng).
