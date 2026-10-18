# Người nhận và nhiều lời chúc riêng tư

Chỉ triển khai nhánh `feat/dm66d-memories-and-letters` vào Vercel **Preview**. Không merge vào `main` và không dùng project dữ liệu thật để thử. Mã sinh viên và nội dung lời chúc được nhập trực tiếp từ máy tin cậy vào Supabase; không biên dịch thành JavaScript, JSON công khai hoặc lưu trong Git.

Người nhận chỉ nhập tên và mã sinh viên. Điều kiện mở lời chúc là tên đã chuẩn hóa đúng **và** mã khớp với cùng một người nhận; sai một trong hai thì báo lỗi chung. Điều kiện được thực hiện phía máy chủ để danh sách mã và nội dung riêng được giữ trong cơ sở dữ liệu. Khi mở thành công, trang hiển thị số lượng và cho chọn từng lời chúc.

## Excel mẫu

Trong trang quản trị `/#/admin`, sau khi đăng nhập, chọn **Tải Excel mẫu: Người nhận và Lời chúc**. File cũng có tại `/downloads/DM66D-private-wishes-template.xlsx`. Đây là file trống với đúng hai sheet **Người nhận** và **Lời chúc**; dòng 4 là tiêu đề, điền dữ liệu từ dòng 5. Các ghi chú ở tiêu đề cột mô tả cách điền. Có thể thêm dòng sau vùng được tô màu; giới hạn 1.000 người nhận và 10.000 lời chúc mỗi lần nhập.

- **Người nhận:** `ID người nhận *`, `Họ và tên *`, `Mã sinh viên *`, `Tên hiển thị`, `Ảnh (URL hoặc đường dẫn)`, `Giới thiệu`, `Tính cách`, `Kỷ niệm`.
- **Lời chúc:** `ID lời chúc *`, `ID người nhận *`, `Tiêu đề`, `Người gửi`, `Nội dung lời chúc *`, `Thứ tự`.

Mỗi người nhận có một ID ổn định, không lấy mã sinh viên làm ID. Mỗi lời chúc có một ID riêng và liên kết bằng ID người nhận. Một ID người nhận có thể xuất hiện ở nhiều dòng trong sheet **Lời chúc**. Giữ nguyên ID khi sửa nội dung để lần nhập sau cập nhật đúng bản ghi. ID chỉ gồm chữ ASCII, số, dấu gạch dưới hoặc gạch ngang, tối đa 80 ký tự.

Nhập mã sinh viên bằng định dạng **Văn bản / Text** để giữ số 0 đầu; importer từ chối ô kiểu số, ngày tháng, công thức hoặc lỗi. Mã được cắt khoảng trắng hai đầu, đổi thành chữ hoa, có 3–64 ký tự A–Z, 0–9, dấu chấm, gạch dưới hoặc gạch ngang. Họ tên được so sánh không phân biệt dấu, hoa/thường và khoảng trắng lặp. Không được lặp cặp tên đã chuẩn hóa và mã. Những người trùng tên có thể dùng mã khác nhau.

`Tên hiển thị` trống sẽ dùng họ tên. Tiêu đề trống sẽ dùng “Lời chúc dành cho cậu”; người gửi trống sẽ hiển thị “Một người bạn DM66D”. Nội dung lời chúc là văn bản bắt buộc, tối đa 10.000 ký tự, có thể xuống dòng. `Thứ tự` là số nguyên không âm; nhỏ hơn hiển thị trước, để trống sẽ dùng thứ tự dòng. Ảnh tùy chọn phải là đường dẫn `/images/…` hoặc URL HTTPS; không đặt mã sinh viên hay nội dung riêng trong tên file hoặc URL.

**File đã điền chứa dữ liệu riêng.** Lưu ngoài repository, hoặc trong `dm66-website/.private/` đã được gitignore. Không đặt trong `public/`, `src/`, file đính kèm PR, issue, log CI hay chat. Mẫu trống là file Excel duy nhất cần đưa vào website. `.gitignore` giúp tránh commit nhầm nhưng không thay thế việc kiểm tra `git status` và bản diff trước khi đẩy code.

## Chuẩn bị Supabase Preview

1. Dùng project Supabase riêng cho Preview. Chạy migration hiện có và migration người nhận/lời chúc mới trong `supabase/migrations/`, theo thứ tự tên file. Đây là bước quản trị thủ công qua SQL Editor hoặc Supabase CLI trên project đã xác nhận; không chạy lên Production để thử.
2. Cấu hình `SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` trong môi trường **máy chủ** Vercel, chỉ chọn **Preview**. Không dùng tiền tố `VITE_`; không đưa giá trị khóa vào repository hoặc chat. Máy nhập Excel cần `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong biến môi trường riêng, lấy từ kho bí mật được phép dùng. Importer không tự đọc `.env` hoặc ghi file chứa khóa.
3. `SUPABASE_KEY_FORMAT=legacy` cho khóa JWT legacy, gồm cả khóa legacy bị proxy che giá trị. `modern` dành cho secret/publishable key mới; quyền nhập vẫn bắt buộc dùng **secret/service_role**, không dùng publishable/anon. `auto` nhận dạng JWT có ba phần và thêm Bearer; khóa opaque qua proxy cần cấu hình định dạng rõ ràng.
4. Redeploy Preview sau khi cấu hình. Không có dữ liệu hoặc cấu hình thì form báo lỗi và không trả lời chúc giả.

RLS chặn truy cập trực tiếp bằng khóa `anon`/`authenticated`; các RPC nhập chỉ cấp quyền `service_role`. Toàn bộ workbook được nhập qua `dm66_import_workbook(p_recipients jsonb, p_wishes jsonb)` trong **một giao dịch**. PostgreSQL băm mã bằng bcrypt; không lưu mã nguyên văn. Dữ liệu gửi qua HTTPS có xác minh chứng chỉ. Importer giữ xác minh TLS, dùng proxy/CA chuẩn của máy và từ chối chuyển hướng HTTP để không chuyển tiếp khóa hoặc workbook sang nơi khác.

## Kiểm tra và nhập từ máy tin cậy

Cần Python 3.10 trở lên. Tạo virtualenv trong thư mục được phép ghi; không thay đổi thư viện hệ thống:

```bash
python -m venv /tmp/dm66-import-venv
/tmp/dm66-import-venv/bin/python -m pip install -r scripts/requirements-import.txt

# Mặc định chỉ kiểm tra toàn bộ file, không kết nối mạng và không ghi database.
/tmp/dm66-import-venv/bin/python scripts/import_private_wishes.py /duong-dan-rieng/loi-chuc.xlsx

# Chỉ chạy khi biến môi trường máy chủ đã được cấp qua kho bí mật.
/tmp/dm66-import-venv/bin/python scripts/import_private_wishes.py /duong-dan-rieng/loi-chuc.xlsx --apply
```

Importer kiểm tra toàn bộ cấu trúc, độ dài, kiểu ô, ID trùng và liên kết trước khi gửi bất kỳ yêu cầu ghi nào. Nó chỉ ghi số lượng và vị trí ô lỗi ra màn hình, không ghi tên, mã, nội dung, khóa hay phản hồi thô từ Supabase; không tạo bản JSON trung gian. Mẫu trống được phép kiểm tra, nhưng không được gửi bằng `--apply`.

Nhập lại cùng ID là **upsert**: cập nhật các trường của người nhận và lời chúc đã có, tạo ID mới nếu chưa có. **Xóa dòng khỏi Excel không xóa dữ liệu đã nhập.** Các ID không xuất hiện trong file vẫn được giữ. Muốn xóa cần thao tác quản trị có chủ đích trên Supabase Preview, không dựa vào importer. Nhập lại người nhận thu hồi các phiên đăng nhập trước đó; người đó cần đăng nhập lại. Đổi mã làm mất hiệu lực mã cũ; đăng nhập lại để kiểm tra mã mới.

Nếu server từ chối giao dịch thì không ghi một phần workbook. Nếu mất kết nối đúng lúc commit, kết quả có thể chưa được xác nhận; chạy lại với **cùng các ID** là an toàn. Không tạo ID mới để retry. Nếu gặp lỗi chứng chỉ, sửa CA/proxy, không tắt xác minh TLS.

## Kiểm tra trước khi chia sẻ Preview

- Dùng dữ liệu thử tự tạo trong Supabase Preview; không đưa dữ liệu thật vào bộ kiểm thử, ảnh chụp màn hình hoặc bản ghi Playwright.
- Đăng nhập bằng tên và mã hợp lệ; xác nhận tổng số, chọn xem từng lời chúc của chính người đó. Thử tên có dấu/không dấu và khoảng trắng thừa.
- Sai mã, thiếu phiên hoặc dùng phiên người khác phải không trả hồ sơ/lời chúc. Đăng xuất và kiểm tra API trực tiếp; không còn quyền đọc.
- Nhập lại cùng file không tăng bản ghi; nhập file lỗi không ghi bất kỳ phần nào. Kiểm tra cả người trùng tên dùng mã khác nhau.
- Kiểm tra bundle frontend, public assets, `git diff` và log để bảo đảm không chứa dữ liệu đã nhập hay khóa.

Tên và mã sinh viên là cách xác minh đơn giản; mã có thể bị người khác biết và không mạnh bằng mật khẩu riêng hoặc đăng nhập trường học. Chỉ dùng với phạm vi dữ liệu phù hợp, giữ giới hạn thử đăng nhập và không công khai mã. Không hứa bảo mật tuyệt đối chỉ vì mã đã được băm.

Chạy kiểm thử importer và dựng lại mẫu trống:

```bash
/tmp/dm66-import-venv/bin/python -m unittest discover -s scripts -p 'test_private_wishes_import.py'
/tmp/dm66-import-venv/bin/python scripts/create_private_wishes_template.py
```
