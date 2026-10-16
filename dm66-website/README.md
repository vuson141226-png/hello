# Chúc mừng 20/10 · Digital Marketing 66D

Website lời chúc dành riêng cho lớp Digital Marketing 66D, xây dựng bằng React, TypeScript và Vite. Hành trình hiện có 4 trang: Welcome → Our Memories → Your Special Wish → Letters To DM66D Boys. Giữ nguyên trang Welcome và các chức năng tìm tên, thiệp PNG, gửi trái tim, nhạc nền; bổ sung album kỷ niệm và thư gửi lại được lưu tập trung bằng Supabase.

Thiệp cá nhân hóa đặt ảnh lớn bên trái, tiêu đề và lời chúc bên phải trên màn hình rộng; trên điện thoại, các phần xếp dọc để dễ đọc. Thiệp PNG được xuất theo bố cục ngang từ mọi thiết bị.

Mã nguồn ban đầu được giải nén từ `dm66-source.zip` vào thư mục `dm66-website/` trong repository. Thư mục `prebuilt/` lưu bản dựng sẵn của website, không tự cập nhật theo mã nguồn. Lệnh `npm run build` tạo bản mới trong `dist/` (được Git bỏ qua); cần đồng bộ lại `prebuilt/` khi muốn cập nhật bản dựng sẵn sau các lần sửa mã nguồn.

## Chạy trên máy

Cần Node.js **22.12 trở lên** và npm. Từ thư mục gốc repository:

```sh
cd dm66-website
npm ci
npm run dev -- --host 0.0.0.0
```

Mở địa chỉ Vite hiển thị trong terminal. Nếu vừa tạo dự án và chưa có `package-lock.json`, dùng `npm install` trước; sau đó dùng `npm ci` để cài đúng phiên bản đã khóa.

```sh
npm test       # Kiểm thử bằng Vitest
npm run build # Kiểm tra TypeScript và tạo bản production trong dist/
```

Kiểm thử hành trình trên trình duyệt (mở quà, vuốt album, tra cứu và tải PNG):

```sh
npx playwright install chromium # Chỉ cần nếu chưa có Chromium/Playwright browser
npm run test:e2e
```

Trong môi trường đám mây này, Chromium đã có sẵn. Có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` nếu trình duyệt nằm ở đường dẫn khác.

Bốn trang dùng hash route: `/#/`, `/#/our-memories`, `/#/your-wish`, `/#/letters-to-boys`. Link cũ `/#/our-girls` vẫn mở album kỷ niệm. Khu vực quản trị riêng tại `/#/admin`, không tính vào hành trình và yêu cầu đăng nhập quản trị. Khi chia sẻ đường dẫn trực tiếp, giữ nguyên phần `/#/...`.

## Album kỷ niệm và hộp thư

`src/data/memories.ts` là nguồn dữ liệu album: `id`, `title`, `date` tùy chọn, `image`, `description`, `altText`. Thêm ảnh thật vào `public/images/`, rồi thay đường dẫn và câu chuyện trong file dữ liệu. Ba khung hiện tại ghi rõ **mẫu/chờ nội dung**; không dùng ảnh hồ sơ hoặc bịa chuyện thành kỷ niệm thật. Album hiển thị một ảnh ngang giữ nguyên tỷ lệ, hỗ trợ mũi tên, chấm, bàn phím và vuốt.

Trang viết thư chỉ báo thành công sau khi API xác nhận đã lưu PostgreSQL. Hướng dẫn tạo bảng, cấu hình Supabase, tài khoản quản trị và quyền truy cập nằm ở [supabase/README.md](supabase/README.md). Copy `.env.example` sang `.env.local` cho local, nhập ba biến server; `npm run dev` chạy cùng bộ API với Vercel. Chưa cấu hình thì API trả `503 NOT_CONFIGURED`, nội dung đang viết được giữ nguyên để thử lại.

Quản trị đăng nhập tại `/#/admin` để xem tổng số, sắp xếp và tải `DM66_Loi_Nhan_20_10.csv` hoặc `.json`. Cookie xác thực HttpOnly; không có mật khẩu hay khóa bí mật trong frontend. `prebuilt/` chỉ là giao diện tĩnh, không thay thế API/database cho chức năng gửi và quản trị thư.

```sh
npm run test:database # Cần Docker; kiểm tra PostgreSQL thật, restart, retry, rate limit và quyền
```

## Dữ liệu và ảnh

Dữ liệu trong `src/data/girls.ts` gồm **5 hồ sơ thử có ảnh** từ sheet `DANH SACH` của file Excel do người dùng cung cấp. Dòng ABC không được hiển thị vì chưa có ảnh; không nhập sheet `VI DU` hoặc `HUONG DAN`. Các ảnh được ghép như sau:

| Họ tên trong Excel | Tên hiển thị | Ảnh trong `public/images/girls/` |
| --- | --- | --- |
| ABE | 1 | `ban1.png` |
| ABA | 3 | `ban2.jpg` |
| ABZ | 4 | `ban3.jpg` |
| ABQ | 5 | `ban4.jpg` |
| ABD | 6 | `ban5.png` |

Có thể thử tìm `abe` hoặc `1`; tên hiển thị `1` hiện chỉ ứng với ABE. Các gợi ý trên trang tra cứu lấy trực tiếp từ danh sách hiện tại.

Nội dung giữ nguyên cách viết và xuống dòng trong Excel. Biệt danh, tính cách và kỷ niệm chưa được điền nên giữ trống. Cả 5 hồ sơ dùng ảnh được cung cấp (ban1 và ban5 là bản PNG đã che thông tin theo yêu cầu, không lưu bản gốc) và đặt `isPlaceholder: false`; dữ liệu vẫn phục vụ thử nghiệm, cần kiểm tra lại trước khi chia sẻ món quà hoàn chỉnh.

1. Thêm ảnh vào `public/images/`, ví dụ `public/images/minh-anh.jpg`.
2. Sửa hoặc thêm đối tượng trong mảng `girls` của `src/data/girls.ts` theo kiểu `Girl` có sẵn: `id`, `fullName`, `displayName`, `nicknames`, `image`, `introduction`, `personality`, `wish`, cùng `memory` nếu có.
3. Đặt `image` thành đường dẫn từ gốc như `/images/minh-anh.jpg`, không thêm `public/`. Dùng tên tệp chữ thường, không dấu và không có khoảng trắng để tránh lỗi đường dẫn khi deploy.
4. Dùng `id` riêng cho từng người. Nhập đúng họ tên, tên hiển thị và các biệt danh; không tự tạo thông tin cá nhân. Đặt `isPlaceholder: false` sau khi đã thay nội dung mẫu.

Tìm kiếm chạy ngay trên trình duyệt, đối chiếu tên và biệt danh sau khi chuẩn hóa dấu, chữ hoa/thường và khoảng trắng; không đoán gần đúng. Nếu nhiều người có cùng tên hoặc biệt danh, người dùng chọn đúng người từ danh sách kết quả. Nên dùng tên và biệt danh đủ phân biệt để giảm nhầm lẫn.

**Dữ liệu tĩnh có thể được mọi khách truy cập đọc.** Trang lời chúc không phải khu vực bảo mật, dù khách cần tìm tên để mở thiệp. Không đưa bí mật, số điện thoại, địa chỉ hoặc nội dung riêng tư vào mã nguồn.

Ảnh trong `public/images/` được khuyến nghị cho chức năng tải PNG. Ảnh từ dịch vụ bên ngoài cần cho phép CORS; ảnh vẫn có thể hiển thị trên trang nhưng bị chặn khi xuất thiệp. Kiểm tra tải PNG trên bản đã deploy sau khi thay ảnh.

## Dữ liệu album kỷ niệm

Mẫu Excel: [DM66D-memories-template.xlsx](public/downloads/DM66D-memories-template.xlsx). Điền sheet `Du_lieu_ky_niem`, mỗi dòng là một kỷ niệm; gửi kèm `anh-ky-niem.zip` với tên ảnh khớp cột `image`. Cột `date` là chữ hiển thị trên dải nhãn góc trái ảnh, chấp nhận ngày, tháng/năm hoặc tên dịp. Sheet `Vi_du_minh_hoa` chỉ để tham khảo. Dữ liệu website được quản lý trong `src/data/memories.ts`; file mẫu dùng để chuẩn bị dữ liệu gửi lại, không phải chức năng tự nhập Excel trên website.

## Lưu thiệp PNG

Bản PNG được vẽ trực tiếp bằng Canvas để tránh lỗi mất ảnh và chồng chữ khi xuất qua SVG trên WebKit/Safari. Ảnh tải và giải mã đầy đủ trước khi vẽ; chữ được đo sau khi tải phông tiếng Việt, tự xuống dòng và dành chỗ riêng cho chữ ký. Kích thước canvas được giới hạn để tránh ảnh trắng khi lời chúc dài trên điện thoại.

Website chuẩn bị sẵn PNG sau khi mở thiệp; đợi nút lưu sẵn sàng rồi chọn:

- **Máy tính:** Chrome/Edge có hỗ trợ Save As cho phép chọn thư mục lưu. Firefox/Safari tải theo tùy chọn tải xuống của trình duyệt.
- **Điện thoại:** nếu trình duyệt hỗ trợ chia sẻ tệp PNG, nút lưu mở bảng chia sẻ của hệ thống. Chọn **Lưu hình ảnh / Save Image / Photos** nếu có; website không thể tự ghi ảnh vào thư viện Photos.
- Nếu chia sẻ không khả dụng hoặc không có mục lưu ảnh, chọn **Mở ảnh để lưu vào máy**. Hộp xem hiển thị PNG đầy đủ để nhấn giữ và lưu; cũng có thể chọn **Tải ảnh PNG** hoặc **Mở ảnh riêng**.

## Nhạc nền tùy chọn

Thêm tệp âm thanh có quyền sử dụng vào `public/audio/background.mp3`, rồi đặt `siteConfig.musicSrc` trong `src/config.ts` thành `/audio/background.mp3`. Giá trị mặc định `null` tắt tính năng nhạc.

Nhạc chỉ phát sau thao tác bật của người dùng; website không tự phát âm thanh. Kiểm tra cả thao tác bật và tắt trên điện thoại sau khi thêm tệp.

## Deploy

Website đầy đủ được triển khai trên **Vercel**, chọn **Root Directory** là `dm66-website`, framework Vite, build `npm run build`, output `dist`. Các API Node trong `api/` được Vercel triển khai cùng giao diện; cần cấu hình ba biến server Supabase theo [hướng dẫn backend](supabase/README.md) và redeploy Preview sau khi lưu biến.

Bản thay đổi dùng **Vercel Preview riêng** để kiểm tra trước khi phát hành. Việc tạo Preview không cập nhật website production. Cấu hình Netlify cũ vẫn còn trong repository, nhưng chỉ phục vụ giao diện tĩnh; chưa có bản chuyển đổi API thư sang Netlify Functions.

Dự án dùng đường dẫn gốc `/`, phù hợp khi deploy ở tên miền hoặc subdomain riêng. Nếu phục vụ dưới một thư mục con, cần điều chỉnh `base` của Vite và các đường dẫn tài nguyên trước khi build.

Trước khi chia sẻ, chạy `npm test` và `npm run build`, rồi kiểm tra trên bản Preview:

- Cả bốn trang, CTA và đường dẫn chia sẻ trực tiếp hoạt động trên máy tính, điện thoại.
- Tìm bằng họ tên có dấu, không dấu và biệt danh; thử tên không tồn tại và tên trùng.
- Ảnh và lời chúc đúng người, nội dung không còn là dữ liệu mẫu.
- Thiệp PNG tải được, đủ chữ tiếng Việt và ảnh; nhạc bật/tắt được nếu đã cấu hình.
