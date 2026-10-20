# Nhập dữ liệu kỷ niệm lớp

Nguồn: `DM66D-memories-template (1) (2).xlsx` và `anhkyniem.zip` do người dùng cung cấp.

- Đã nhập **15 sự kiện**, mỗi sự kiện có hai vị trí ảnh.
- Đã sử dụng **30 ảnh JPEG gốc**, giữ nguyên từng byte; chỉ chuẩn hóa tên file về chữ thường.
- Có **0 ảnh thiếu**; những ảnh chưa có mới dùng khung trống trung tính, không lấy ảnh sự kiện khác thay vào.
- Có **0 mô tả trống** trong dữ liệu đã nhập.
- Chỉ đọc sheet `Du_lieu_ky_niem`; không nhập ví dụ hoặc diễn giải ghi chú thành dữ liệu.
- Giữ đầy đủ tiêu đề và mô tả nguyên văn, chỉ bỏ khoảng trắng ở hai đầu ô.
- Không sao chép workbook hoặc ZIP gốc vào thư mục công khai.

## Các điểm đã xử lý

- `ky-niem-06`: tên ảnh `cnxkh1.jpg` trong Excel được đối chiếu rõ ràng với `cnxhkh1.jpg` trong ZIP.
- `ky-niem-13`: ô tên sự kiện trống; dùng **Boy Day 2026** vì mô tả ghi rõ tên này.
- Theo yêu cầu chỉnh nội dung sau Excel: `ky-niem-05` dùng mô tả ngày 8/3 đầu tiên với bánh có khuôn mặt và banner; `ky-niem-12` dùng mô tả 8/3/2026 với video, banner, sính lễ và bánh. Khi nhập lại workbook, giữ hai mô tả đã cập nhật tại `Du_lieu_ky_niem!E6` và `E13`; tiêu đề và ảnh của hai sự kiện giữ nguyên.
- `ky-niem-13` (Boy Day 2026): bổ sung ô video nhỏ cạnh hai ảnh trong cùng cụm trang trí, phía trên mô tả, từ [liên kết Drive người dùng gửi](https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/view). Cấu hình trong `src/data/memoryVideos.ts` nối theo ID sự kiện, độc lập với dữ liệu Excel được sinh lại. Ô nhỏ dùng đoạn video gốc giây 2–8 làm xem trước tắt tiếng, chỉ chạy khi ở trong màn hình và người xem không bật giảm chuyển động. Khi Drive không cấp dữ liệu video trực tiếp, dùng thumbnail của chính video. Bấm ô mở hộp xem Drive lớn ở giữa màn hình, có nơ, tim, hoa trang trí; trình phát giữ nguyên kích thước đầy đủ, không áp dụng phép xoay/cắt lên iframe. Đóng hộp hoặc chuyển sự kiện/rời trang sẽ gỡ trình phát. Nhạc nền MP3 tạm dừng suốt thời gian hộp video mở, phát tiếp nếu người xem vẫn bật nhạc. Liên kết mở riêng trên Drive được giữ. Video Drive thật chưa được kiểm chứng trong môi trường đám mây vì chính sách mạng chặn Drive; kiểm thử video dùng clip thử và iframe giả. Nhạc nền dùng MP3 người dùng cung cấp, đã có kiểm thử giải mã và phát tệp thật; các trường hợp quyền tự phát dùng mô phỏng riêng.
- Excel không cung cấp thời gian riêng cho các sự kiện; không tự gán ngày hoặc năm.

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
| `ky-niem-15` | Lẩu Phann | 2/2 |

## Chạy lại

Từ `dm66-website`, dùng môi trường Python đã cài `scripts/requirements-import.txt`:

```bash
.venv-import/bin/python scripts/import_memories.py '/duong-dan/DM66D-memories-template (1) (2).xlsx' '/duong-dan/anhkyniem.zip'
```

Công cụ kiểm tra ZIP, từ chối đường dẫn không an toàn, symlink, công thức trong các ô dữ liệu và ảnh bị trùng tên; không giải nén tùy ý. Những ảnh hiện có có nội dung khác sẽ không bị ghi đè.
