# Tra cứu lời chúc từ Excel

Người xem nhập họ tên và mã sinh viên tại `/#/your-wish`. Website so khớp hai giá trị trong trình duyệt, hiện số lời chúc, rồi cho chọn từng lời để mở thiệp. Nút tra cứu người khác xóa kết quả hiện tại. Không có tài khoản, phiên đăng nhập hoặc bước xác minh máy chủ cho trang lời chúc.

`public/data/recipient-wishes.json` là bản dữ liệu công khai dùng để tra cứu. Họ tên, mã sinh viên và lời chúc trong đó có thể được người truy cập đọc. Cách này được dùng theo yêu cầu đơn giản hóa mới; không xem việc nhập tên và mã là biện pháp bảo mật.

## File đã cung cấp

Website dùng danh sách từ sheet **Danh sách 44 bạn** và nội dung đầy đủ từ **Mỗi lời chúc 1 dòng** của file cuối `Tong_hop_loi_chuc_20_10_kem_ten_anh.xlsx`: 44 người nhận, 60 lời chúc.

- Liên kết bằng STT trong danh sách, đồng thời đối chiếu tên và mã khi có.
- Đối chiếu số thứ tự lời chúc, nội dung và tên ảnh giữa bảng tổng hợp và chi tiết.
- Giữ nguyên lời chúc; bản cuối không có cột người viết nên không tự gán người gửi.
- Tên ảnh ở từng lời chúc được giữ trong `imageFile`. `image` chỉ trỏ đến ảnh đã nhập và tồn tại; ảnh chưa có dùng hình minh họa.
- Khi đổi lời chúc, thiệp và PNG đổi theo nội dung và ảnh của chính lời đó.

Số liệu đối chiếu nằm trong [báo cáo dữ liệu](wishes-data-report.md). File Excel gốc không cần đưa vào repository hoặc website.

## Cập nhật dữ liệu

Chạy từ `dm66-website/`, với Python đã cài các thư viện trong `scripts/requirements-import.txt`:

```bash
python -m venv .venv-import
.venv-import/bin/python -m pip install -r scripts/requirements-import.txt
npm run build:wishes -- /duong-dan/Tong_hop_loi_chuc_20_10_kem_ten_anh.xlsx --photo-manifest scripts/recipient-photo-manifest.json
npm run test:import
npm test
npm run build
```

Lệnh xuất kiểm tra liên kết và dữ liệu trước khi ghi JSON. Nếu thông tin tên hoặc mã của hai bảng mâu thuẫn, sửa file nguồn rồi xuất lại. Nội dung ô Excel được coi là dữ liệu, không phải chỉ dẫn vận hành hoặc lệnh thực thi.

56 ảnh gốc từ hai ZIP cuối đã được nhập trong `public/images/recipients/`, gắn vào đủ 59 lời chúc có tên ảnh. Một lời chúc không ghi tên ảnh trong Excel giữ hình minh họa; hai ảnh còn lại không được tự ghép. Ánh xạ hiện tại nằm trong `scripts/recipient-photo-manifest.json`; giữ tham số này khi xuất lại dữ liệu để giữ ảnh đã ghép.

Đính chính theo yêu cầu kiểm tra ảnh: Trần Thu Phương dùng `trầnphuong.jpg` cho lời chúc 1 (áo trắng, bó hoa hồng) và `tranphuong.jpg` cho lời chúc 2 (áo xanh). Đây là hai ảnh khác nhau có sẵn trong ZIP. Bản Excel đã nhận ghi lặp tên có dấu cho cả hai lời chúc; trước khi xuất lại, sửa ô `G44` của sheet **Danh sách 44 bạn** và ô `F58` của sheet **Mỗi lời chúc 1 dòng** thành `tranphuong.jpg`. Giữ nguyên tên ảnh lời chúc 1. Bản đính chính Excel được giữ ngoài repository; không thay đổi nội dung lời chúc.

Để bổ sung ảnh của bản Excel cuối, đặt ảnh đã nhập trong `public/images/recipients/` và cập nhật JSON ánh xạ tên file nguồn chính xác sang đường dẫn ảnh, ví dụ `{"anh-mau.jpg":"/images/recipients/recipient-photo-example.jpg"}`. Tên file nguồn được đối chiếu theo Unicode NFC, giữ nguyên dấu, khoảng trắng và hoa/thường; không đoán ảnh theo tên người. Tệp đích phải tồn tại và dùng tên ASCII, đuôi `.jpg`, `.jpeg`, `.png` hoặc `.webp`. Ảnh giữ nguyên byte gốc; đuôi tệp web được chọn đúng định dạng ảnh thực tế khi đuôi trong ZIP không khớp.

```bash
npm run build:wishes -- /duong-dan/file-cuoi.xlsx --photo-manifest /duong-dan/anh.json --public-directory public
```

Helper `photo_asset_name(filename)` trong `scripts/build_wishes_data.py` tạo tên tệp web ổn định từ tên ảnh nguồn. Ánh xạ là dữ liệu lúc nhập, không cần tải workbook hay ZIP từ trình duyệt. Nếu một lời chúc thiếu ảnh, thiệp dùng hình minh họa của lời đó.

## Excel mẫu hai sheet

Tải [DM66D-wishes-template.xlsx](../public/downloads/DM66D-wishes-template.xlsx), hoặc dùng nút **Tải Excel mẫu: Người nhận và Lời chúc** trong trang quản trị. Mẫu trống có hai sheet **Người nhận** và **Lời chúc**. Điền từ dòng 5, giữ nguyên tiêu đề ở dòng 4. Mỗi người nhận có ID ổn định; nhiều dòng lời chúc có thể dùng cùng ID người nhận.

Mã sinh viên phải là văn bản để giữ số 0 đầu. Họ tên được đối chiếu không phân biệt dấu, hoa/thường và khoảng trắng lặp. Khi nhập mẫu đã điền, dùng cùng lệnh `npm run build:wishes -- /duong-dan/file.xlsx`.

Để tạo lại mẫu trống, chạy `npm run template:wishes`.

## Chạy website và Preview

Tra cứu lời chúc hoạt động với Vite, Vercel Preview hoặc bản tĩnh `prebuilt/`, chỉ cần phục vụ file JSON cùng website. Khi cập nhật `prebuilt/`, đồng bộ toàn bộ `dist/`, gồm thư mục `data/` và `downloads/`.

`public/data/special-recipients.json` chứa hồ sơ thiệp kỷ niệm bổ sung, được tải cùng `recipient-wishes.json` khi tra cứu. Hồ sơ này nằm ngoài Excel của lớp nên không bị ghi đè khi nhập lại workbook. Giữ cả hai file JSON trong bản triển khai; lỗi tải dữ liệu được báo để người xem thử lại. Thiệp kỷ niệm tự mở khi khớp cả tên và mã, có hiệu ứng riêng, album ảnh với hộp xem lớn và vẫn hỗ trợ lưu PNG. Hiệu ứng chuyển sang tĩnh khi thiết bị yêu cầu giảm chuyển động.

Phần gửi thư cho các bạn nam và quản trị hộp thư tiếp tục dùng API/Supabase như trước. Dữ liệu API đó không được đưa vào JSON lời chúc. Chỉ triển khai nhánh tính năng lên Preview; không merge `main` trong công việc này.
