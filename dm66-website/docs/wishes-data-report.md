# Đối chiếu dữ liệu lời chúc

Dữ liệu được tạo từ workbook người dùng cung cấp; giữ nguyên nội dung, dấu và xuống dòng của từng lời chúc.

- Người nhận: 44.
- Lời chúc: 62.
- Người nhận thiếu mã sinh viên trong danh sách chính: 0.

| Số lời chúc mỗi người | Số người nhận |
| --- | --- |
| 1 | 28 |
| 2 | 14 |
| 3 | 2 |

Tất cả người nhận trong danh sách đều đã có lời chúc.

Hai sheet dữ liệu cuối cùng được đối chiếu theo STT, họ tên, mã sinh viên và số thứ tự lời chúc. Từng nội dung và tên tệp ảnh phải trùng khớp giữa hai sheet; số lượng được tính từ nội dung thực tế, không chạy công thức Excel.

Workbook không có cột người gửi. Tiêu đề dùng số thứ tự lời chúc; không suy đoán người viết từ lời văn hoặc dữ liệu cũ. Sheet kiểm tra tên ảnh chỉ là thông tin bổ sung và không được dùng để tự đoán ảnh cho người nhận.

- Lời chúc có tên tệp ảnh trong nguồn: 61.
- Tên tệp ảnh riêng biệt được tham chiếu: 56.
- Lời chúc không có tên tệp ảnh: 1.
- Tệp ảnh đã nhập và kiểm tra tồn tại: 56.
- Lời chúc đã gắn được ảnh: 61.
- Tệp ảnh còn thiếu: 0.

Tên tệp nguồn được giữ trong trường imageFile của từng lời chúc. Chỉ gắn đường dẫn ảnh khi có ánh xạ tên tệp chính xác (cho phép chuẩn hóa Unicode) và tệp đích thực sự tồn tại trong public; không ghép ảnh theo tên gần giống. Khi chưa có ảnh, giao diện tiếp tục dùng ảnh minh họa trung tính.

JSON tạo ra ở `public/data/recipient-wishes.json` là dữ liệu công khai phục vụ tra cứu trong trình duyệt. Workbook nguồn không được sao chép vào repository. Báo cáo này chỉ chứa số lượng, không chứa mã sinh viên hay nội dung lời chúc.
