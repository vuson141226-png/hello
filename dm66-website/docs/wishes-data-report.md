# Đối chiếu dữ liệu lời chúc

Dữ liệu được tạo từ workbook người dùng cung cấp; giữ nguyên nội dung, dấu và xuống dòng của từng lời chúc.

- Người nhận: 44.
- Lời chúc: 53.
- Người nhận thiếu mã sinh viên trong danh sách chính: 0.

| Số lời chúc mỗi người | Số người nhận |
| --- | --- |
| 0 | 5 |
| 1 | 26 |
| 2 | 12 |
| 3 | 1 |

Các người nhận chưa có lời chúc vẫn nằm trong danh sách để giao diện hiển thị đúng số lượng 0.

Danh sách chính xác định người nhận bằng STT, họ tên và mã sinh viên. Sheet chi tiết cung cấp nguyên văn từng lời chúc; chương trình kiểm tra họ tên/mã có sẵn và đối chiếu toàn bộ người viết/nội dung với danh sách chính.

Có 3 dòng chi tiết trống mã sinh viên; các dòng này được nối bằng STT và họ tên đã khớp với danh sách chính. Không tạo hay suy đoán mã mới.

Ghi chú về mã sinh viên ở sheet nguồn không còn đồng nhất với các ô dữ liệu đã điền; chương trình sử dụng các ô của danh sách chính và không áp dụng ghi chú cũ để xóa mã hiện có.

Workbook không cung cấp ảnh chân dung tương ứng, nên toàn bộ người nhận dùng ảnh minh họa trung tính. Không gán ảnh từ danh sách cũ.

JSON tạo ra ở `public/data/recipient-wishes.json` là dữ liệu công khai phục vụ tra cứu trong trình duyệt. Workbook nguồn không được sao chép vào repository. Báo cáo này chỉ chứa số lượng, không chứa mã sinh viên hay nội dung lời chúc.
