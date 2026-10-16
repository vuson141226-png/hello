# Lưu lời nhắn DM66D bằng Supabase

Website dùng các API server Vercel trong `api/`. Ảnh/thiệp không thay đổi. Lời nhắn chỉ báo thành công khi PostgreSQL đã xác nhận ghi qua RPC; không lưu lời nhắn vào localStorage hoặc ổ đĩa tạm Vercel.

## Kết nối môi trường Preview

1. Tạo một Supabase project riêng cho bản thử nghiệm. Mở **SQL Editor**, chạy toàn bộ `migrations/202610160001_dm66_letters.sql`. Hoặc dùng Supabase CLI `supabase db push` với project đã liên kết.
2. Trong **Authentication → Users**, tạo người dùng quản trị với email và mật khẩu riêng, bật xác nhận email cho tài khoản này nếu tạo thủ công. Không bật đăng ký công khai trong giao diện website.
3. Sao chép UUID người dùng vừa tạo và chạy:

   ```sql
   insert into public.dm66_admins(user_id)
   values ('UUID_CUA_TAI_KHOAN_QUAN_TRI')
   on conflict do nothing;
   ```

4. Thêm ba biến **server** vào Vercel Project → Settings → Environment Variables, chỉ chọn **Preview** cho bản thử nghiệm:

   - `SUPABASE_URL`: project URL, dạng `https://PROJECT.supabase.co`.
   - `SUPABASE_ANON_KEY`: publishable/legacy anon API key cho Supabase Auth server-side.
   - `SUPABASE_SERVICE_ROLE_KEY`: secret/legacy service_role key. Đây là bí mật có quyền cao, tuyệt đối không đặt tên với tiền tố `VITE_`, không commit, không gửi qua ô chat hay gắn vào frontend.

5. Redeploy nhánh thử nghiệm. Khi chưa cấu hình, API trả `503 NOT_CONFIGURED`; form giữ nội dung và không giả báo gửi thành công.
6. Mở `/#/admin`, đăng nhập tài khoản đã thêm vào allowlist. Người dùng Auth khác cũng không được đọc/xuất lời nhắn.

Có thể dùng cùng các biến trong `.env.local` đã được gitignore khi chạy API runner local; không đưa file này vào GitHub. Một project Supabase riêng giúp thử nghiệm không lẫn với dữ liệu lớp thật. Nên bật backup phù hợp trước khi dùng chính thức.

## API và xác thực

- `POST /api/letters`: `{senderName?, message, submissionId, website?: ""}`. `submissionId` là UUID được giữ nguyên khi gửi lại cùng nội dung. Trả `201 {letter}` sau khi lưu, hoặc `200 {letter}` nếu là gửi lại đã lưu. Một ID với nội dung khác trả `409`.
- `POST /api/admin/login`: `{email,password}`; `GET /api/admin/session`; `POST /api/admin/logout`.
- `GET /api/admin/letters?order=newest|oldest`: `{letters,total}`.
- `GET /api/admin/export?format=csv|json&order=newest|oldest`: tải `DM66_Loi_Nhan_20_10.csv` hoặc `.json`. CSV có BOM UTF-8 cho Excel và vô hiệu hóa công thức do dữ liệu người dùng nhập.

Phiên quản trị dùng cookie `HttpOnly`, `SameSite=Strict`, `Secure` trên HTTPS. Token truy cập được kiểm tra với Supabase Auth mỗi lần đọc và token refresh được xoay khi hết hạn. Danh sách quản trị được kiểm tra trên máy chủ mỗi lần đọc/xuất. Không trả token hoặc service key về mã frontend. Các yêu cầu ghi bắt buộc có `Origin` khớp host để chống CSRF; mọi API trả `Cache-Control: no-store`.

Tất cả bảng bật RLS, không có policy dành cho người dùng thường. RPC chỉ cấp quyền `service_role`. SQL kiểm tra độ dài độc lập với API. Rate limit lưu tập trung trong PostgreSQL: 30 thư mới/phút/IP và 10 lần đăng nhập/10 phút/IP; retry cùng ID không tính thêm thư. IP được HMAC trước khi lưu, không lưu IP thô. Vercel phải trực tiếp nhận request để header `x-forwarded-for` là header đáng tin từ edge; khi tự host phía sau proxy khác cần thiết lập proxy tin cậy tương đương. Rate counter cũ quá hai ngày được dọn khi có request mới.

## Kiểm tra thực tế trước khi công bố

1. Gửi ít nhất hai lời nhắn với hai ID khác nhau từ hai trình duyệt; chỉ chấp nhận thành công HTTP `201` và trạng thái `saved`.
2. Tải lại trang, đăng nhập quản trị, xác nhận cả hai lời nhắn còn tồn tại và tổng số tăng đúng hai. Thử gửi lại cùng ID/nội dung, xác nhận HTTP `200` và không tăng tổng số.
3. Đổi thứ tự mới nhất/cũ nhất, tải CSV và JSON, mở trên máy tính để đối chiếu tên, nội dung tiếng Việt, thời gian và số bản ghi.
4. Đăng xuất rồi truy cập trực tiếp API danh sách/xuất; phải nhận `401`. Tài khoản Auth không nằm trong `dm66_admins` cũng phải bị từ chối.
5. Ngắt kết nối DB hoặc gỡ biến môi trường trong môi trường thử, gửi thư: không có màn hình thành công và nội dung vẫn giữ nguyên.

Các bài kiểm tra mock trong `server/*.test.ts` chỉ kiểm tra hợp đồng API và tình huống lỗi, không thay thế bước gửi thật vào Supabase. Chạy kiểm tra server bằng `npx tsc -p server/tsconfig.json` và `npx vitest run --config server/vitest.config.ts`.

Nếu có Docker, chạy `node server/test-postgres.mjs` để kiểm tra migration trên PostgreSQL 17 thật trong container riêng: hai thư thử nghiệm, dữ liệu còn sau khi khởi động lại database, retry đồng thời không trùng thư, validation, rate limit tập trung và chặn quyền `anon`/`authenticated`. Container tự xóa sau kiểm tra, không mở cổng PostgreSQL ra máy chủ. Kiểm tra này đã chạy thành công ở môi trường phát triển; nó không đồng nghĩa với việc project Supabase online đã được cấu hình.
