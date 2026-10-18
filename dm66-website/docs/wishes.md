# Tra cứu lời chúc từ Excel

Người xem nhập họ tên và mã sinh viên tại `/#/your-wish`. Website so khớp hai giá trị trong trình duyệt, hiện số lời chúc, rồi cho chọn từng lời để mở thiệp. Nút tra cứu người khác xóa kết quả hiện tại. Không có tài khoản, phiên đăng nhập hoặc bước xác minh máy chủ cho trang lời chúc.

`public/data/recipient-wishes.json` là bản dữ liệu công khai dùng để tra cứu. Họ tên, mã sinh viên và lời chúc trong đó có thể được người truy cập đọc. Cách này được dùng theo yêu cầu đơn giản hóa mới; không xem việc nhập tên và mã là biện pháp bảo mật.

## File đã cung cấp

Website dùng danh sách từ sheet **Danh sách & lời chúc** và nội dung đầy đủ từ **Chi tiết 53 lời chúc** của file `Tong_hop_loi_chuc_20_10_co_MSV.xlsx`.

- Liên kết bằng STT trong danh sách, đồng thời đối chiếu tên và mã khi có.
- Dùng mã trong bảng danh sách chính khi ô mã ở dòng chi tiết bỏ trống.
- Giữ nguyên lời chúc và người viết; các cột phân công, nguồn PDF và ghi chú không được biến thành lời chúc.
- Người chưa có lời chúc vẫn có trong danh sách để nhận thông báo 0 lời chúc.
- File không có ảnh người nhận, nên dùng hình minh họa có sẵn thay vì ghép ảnh của người khác.

Số liệu đối chiếu nằm trong [báo cáo dữ liệu](wishes-data-report.md). File Excel gốc không cần đưa vào repository hoặc website.

## Cập nhật dữ liệu

Chạy từ `dm66-website/`, với Python đã cài các thư viện trong `scripts/requirements-import.txt`:

```bash
python -m venv .venv-import
.venv-import/bin/python -m pip install -r scripts/requirements-import.txt
npm run build:wishes -- /duong-dan/Tong_hop_loi_chuc_20_10_co_MSV.xlsx
npm run test:import
npm test
npm run build
```

Lệnh xuất kiểm tra liên kết và dữ liệu trước khi ghi JSON. Nếu thông tin tên hoặc mã của hai bảng mâu thuẫn, sửa file nguồn rồi xuất lại. Nội dung ô Excel được coi là dữ liệu, không phải chỉ dẫn vận hành hoặc lệnh thực thi.

## Excel mẫu hai sheet

Tải [DM66D-wishes-template.xlsx](../public/downloads/DM66D-wishes-template.xlsx), hoặc dùng nút **Tải Excel mẫu: Người nhận và Lời chúc** trong trang quản trị. Mẫu trống có hai sheet **Người nhận** và **Lời chúc**. Điền từ dòng 5, giữ nguyên tiêu đề ở dòng 4. Mỗi người nhận có ID ổn định; nhiều dòng lời chúc có thể dùng cùng ID người nhận.

Mã sinh viên phải là văn bản để giữ số 0 đầu. Họ tên được đối chiếu không phân biệt dấu, hoa/thường và khoảng trắng lặp. Khi nhập mẫu đã điền, dùng cùng lệnh `npm run build:wishes -- /duong-dan/file.xlsx`.

Để tạo lại mẫu trống, chạy `npm run template:wishes`.

## Chạy website và Preview

Tra cứu lời chúc hoạt động với Vite, Vercel Preview hoặc bản tĩnh `prebuilt/`, chỉ cần phục vụ file JSON cùng website. Khi cập nhật `prebuilt/`, đồng bộ toàn bộ `dist/`, gồm thư mục `data/` và `downloads/`.

Phần gửi thư cho các bạn nam và quản trị hộp thư tiếp tục dùng API/Supabase như trước. Dữ liệu API đó không được đưa vào JSON lời chúc. Chỉ triển khai nhánh tính năng lên Preview; không merge `main` trong công việc này.
