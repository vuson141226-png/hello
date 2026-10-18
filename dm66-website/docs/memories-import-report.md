# Nhập dữ liệu kỷ niệm lớp

Nguồn: `DM66D-memories-template (1) (1).xlsx` và `anhkyniem (2).zip` do người dùng cung cấp.

- Đã nhập **15 sự kiện**, mỗi sự kiện có hai vị trí ảnh.
- Đã sử dụng **28 ảnh JPEG gốc**, giữ nguyên từng byte; chỉ chuẩn hóa tên file về chữ thường.
- Có **2 ảnh thiếu** dùng hình khung trống trung tính, không lấy ảnh sự kiện khác thay vào.
- Chỉ đọc sheet `Du_lieu_ky_niem`; không nhập ví dụ hoặc diễn giải ghi chú thành dữ liệu.
- Giữ đầy đủ tiêu đề và mô tả nguyên văn, chỉ bỏ khoảng trắng ở hai đầu ô.
- Không sao chép workbook hoặc ZIP gốc vào thư mục công khai.

## Các điểm đã xử lý

- `ky-niem-06`: tên ảnh `cnxkh1.jpg` trong Excel được đối chiếu rõ ràng với `cnxhkh1.jpg` trong ZIP.
- `ky-niem-13`: ô tên sự kiện trống; dùng **Boy Day 2026** vì mô tả ghi rõ tên này.
- `ky-niem-02`: mô tả nguồn trống, giữ trống và không tự viết thêm câu chuyện.
- `ky-niem-08`: mô tả nguồn trống, giữ trống và không tự viết thêm câu chuyện.
- `ky-niem-12`: mô tả nguồn trống, giữ trống và không tự viết thêm câu chuyện.
- `ky-niem-15`: ZIP không có `lauphan1.jpg`; giữ sự kiện và hiển thị trạng thái đang chờ ảnh.
- `ky-niem-15`: ZIP không có `lauphan2.jpg`; giữ sự kiện và hiển thị trạng thái đang chờ ảnh.
- Toàn bộ ô thời gian trong Excel trống; không tự gán ngày hoặc năm.

## Danh sách sự kiện

| ID | Tên đầy đủ | Ảnh thật |
| --- | --- | ---: |
| `ky-niem-01` | Gặp gỡ đầu năm | 2/2 |
| `ky-niem-02` | First 20/10 | 2/2 |
| `ky-niem-03` | Ngày hội vui vẻ | 2/2 |
| `ky-niem-04` | First Boy Day | 2/2 |
| `ky-niem-05` | First 08/03 | 2/2 |
| `ky-niem-06` | CNXHKH cô Thuận | 2/2 |
| `ky-niem-07` | Boy Day 2025 | 2/2 |
| `ky-niem-08` | 2 ngày 1 đêm đầu tiênnn | 2/2 |
| `ky-niem-09` | Year end party! | 2/2 |
| `ky-niem-10` | Buscom cùng Trần Việt An | 2/2 |
| `ky-niem-11` | NLPR cô Mai Lê | 2/2 |
| `ky-niem-12` | 08/03/2026 | 2/2 |
| `ky-niem-13` | Boy Day 2026 | 2/2 |
| `ky-niem-14` | Xiuuho | 2/2 |
| `ky-niem-15` | Lẩu Phann | 0/2 |

## Chạy lại

Từ `dm66-website`, dùng môi trường Python đã cài `scripts/requirements-import.txt`:

```bash
.venv-import/bin/python scripts/import_memories.py '/duong-dan/DM66D-memories-template (1) (1).xlsx' '/duong-dan/anhkyniem (2).zip'
```

Công cụ kiểm tra ZIP, từ chối đường dẫn không an toàn, symlink, công thức trong các ô dữ liệu và ảnh bị trùng tên; không giải nén tùy ý. Những ảnh hiện có có nội dung khác sẽ không bị ghi đè.
