# Chúc mừng 20/10 · Digital Marketing 66D

Website lời chúc dành riêng cho lớp Digital Marketing 66D, xây dựng bằng React, TypeScript và Vite. Hành trình hiện có 5 trang: Welcome → Our Memories → Your Special Wish → Letters To DM66D Boys → Photobooth. Giữ nguyên trang Welcome và các chức năng thiệp PNG, gửi trái tim, nhạc nền; bổ sung album kỷ niệm, tra cứu người nhận bằng tên và mã sinh viên, nhiều lời chúc và thư gửi lại được lưu tập trung bằng Supabase.

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

Năm trang dùng hash route: `/#/`, `/#/our-memories`, `/#/your-wish`, `/#/letters-to-boys`, `/#/photobooth`. Link cũ `/#/our-girls` vẫn mở album kỷ niệm. Khu vực quản trị riêng tại `/#/admin`, không tính vào hành trình và yêu cầu đăng nhập quản trị. Khi chia sẻ đường dẫn trực tiếp, giữ nguyên phần `/#/...`.

## Album kỷ niệm và hộp thư

`src/data/memories.ts` lưu 15 sự kiện từ Excel cuối được cung cấp, mỗi sự kiện gồm tên đầy đủ, mô tả và hai ảnh. Album dùng hai khung ảnh gọn, hơi nghiêng và chồng nhẹ lên nhau; giữ tỷ lệ ảnh gốc và hỗ trợ mũi tên, chấm, bàn phím, vuốt trên điện thoại. Đủ 30 ảnh thật nằm trong `public/images/memories/`, gồm cặp ảnh Lẩu Phann. Boy Day 2026 có thêm ô video nhỏ trong cùng cụm hai ảnh, phía trên mô tả; ô nhỏ chạy một đoạn xem trước tắt tiếng (giây 2–8) từ video gốc. Bấm ô này để mở hộp xem lớn ở giữa màn hình, có nơ, tim và hoa trang trí; trình phát Drive giữ nguyên toàn bộ khung, không xoay hoặc cắt trình phát. Đóng bằng nút ×, phím Escape hoặc bấm nền bên ngoài. Video được dừng khi đóng, đổi sự kiện hoặc rời trang. Nếu Drive không cho trình duyệt tải đoạn xem trước, ô nhỏ dùng ảnh thumbnail của chính video và vẫn mở được hộp xem lớn hoặc liên kết Drive. Video đính kèm được nối theo ID sự kiện trong `src/data/memoryVideos.ts` để giữ khi nhập lại Excel. Xem [báo cáo nhập dữ liệu](docs/memories-import-report.md).

Trang viết thư chỉ báo thành công sau khi API xác nhận đã lưu PostgreSQL. Hướng dẫn tạo bảng, cấu hình Supabase, tài khoản quản trị và quyền truy cập nằm ở [supabase/README.md](supabase/README.md). Copy `.env.example` sang `.env.local` cho local, nhập ba biến server; `npm run dev` chạy cùng bộ API với Vercel. Chưa cấu hình thì API trả `503 NOT_CONFIGURED`, nội dung đang viết được giữ nguyên để thử lại.

Quản trị đăng nhập tại `/#/admin` để xem tổng số, sắp xếp và tải `DM66_Loi_Nhan_20_10.csv` hoặc `.json`. Cookie xác thực HttpOnly; không có mật khẩu hay khóa bí mật trong frontend. `prebuilt/` chỉ là giao diện tĩnh, không thay thế API/database cho chức năng gửi và quản trị thư.

```sh
npm run test:database # Cần Docker; kiểm tra PostgreSQL thật, restart, retry, rate limit và quyền
```

## Tra cứu tên, mã sinh viên và lời chúc

Trang `/#/your-wish` đối chiếu họ tên và mã sinh viên ngay trong trình duyệt. Tên được chuẩn hóa dấu, chữ hoa/thường và khoảng trắng; mã được so dưới dạng chuỗi để giữ số 0 đầu. Cả hai phải khớp cùng một dòng. Sau khi tra cứu, trang thông báo số lời chúc, hiển thị các nút để mở từng lời; thiệp và PNG dùng đúng nội dung và ảnh của lời đang chọn. Dữ liệu hiện có 44 người nhận và 62 lời chúc, gồm hai lời bổ sung sau bản Excel cuối. Người có 0 lời chúc vẫn được báo rõ trạng thái này khi cập nhật dữ liệu sau này.

Dữ liệu được xuất từ Excel thành `public/data/recipient-wishes.json`. Đây là dữ liệu công khai, có thể được người truy cập website đọc. Tra cứu này không có đăng nhập, cookie phiên hoặc yêu cầu Supabase. Phần gửi thư và quản trị hộp thư dùng API Supabase hiện có.

- [Excel mẫu: Người nhận và Lời chúc](public/downloads/DM66D-wishes-template.xlsx), cũng có nút tải trong trang quản trị.
- [Hướng dẫn cập nhật dữ liệu](docs/wishes.md).
- [Báo cáo đối chiếu file được cung cấp](docs/wishes-data-report.md).

File Excel gốc được giữ ngoài repository; bản JSON cần cho website được xuất theo yêu cầu công khai mới. Sheet ghi chú chỉ được dùng làm thông tin tham khảo; không ghi đè các giá trị thực tế trong bảng danh sách và chi tiết. Đã ghép 56 ảnh gốc cho 61 lời chúc; một lời không ghi tên ảnh giữ hình minh họa. Ánh xạ được lưu trong `scripts/recipient-photo-manifest.json` để giữ ảnh khi xuất lại dữ liệu. Đính chính hai tên ảnh của Trần Thu Phương và cách giữ các lời chúc mới khi xuất lại nằm trong hướng dẫn cập nhật dữ liệu. Ảnh ngoài miền cần CORS để xuất PNG.

Thiệp kỷ niệm riêng được lưu tại `public/data/special-recipients.json`, đọc cùng danh sách của lớp khi tra cứu. Hồ sơ có cấu hình `anniversary` mở trực tiếp thiệp một tháng yêu nhau, hiệu ứng tim và 11 ảnh trang trí: hai ảnh ở phần mở đầu, chín ảnh chạy dọc hai bên lá thư. Chữ ở giữa liền mạch, có lề ảnh riêng trên cả điện thoại; bấm từng ảnh nhỏ để xem lớn. Các hồ sơ khác giữ luồng chọn từng lời chúc. 11 ảnh gốc nằm trong `public/images/anniversary-phuong/`. Xem [đối chiếu dữ liệu thiệp kỷ niệm](docs/anniversary-data.md). Khi nhập lại Excel, giữ file bổ sung này và đồng bộ toàn bộ `dist/` sang `prebuilt/`.

## Dữ liệu album kỷ niệm

Mẫu Excel: [DM66D-memories-template.xlsx](public/downloads/DM66D-memories-template.xlsx). Điền sheet `Du_lieu_ky_niem`, mỗi dòng là một sự kiện; cột `image` nhận hai tên ảnh, mỗi tên một dòng, cùng ảnh trong ZIP. Cột `title` hiển thị toàn bộ tên sự kiện và `description` hiển thị đầy đủ mô tả. Cột `date` tùy chọn; để trống thì không thêm ngày tự đoán. Sheet hướng dẫn và ví dụ không được nhập thành kỷ niệm thật.

Chạy từ `dm66-website/` để nhập lại file nguồn:

```sh
npm run import:memories -- /duong-dan/ky-niem.xlsx /duong-dan/anh-ky-niem.zip
npm run test:import
npm run build
```

Công cụ kiểm tra file và ánh xạ ảnh trước khi tạo `src/data/memories.ts`, sao chép ảnh gốc vào `public/images/memories/` và ghi báo cáo tổng hợp. File Excel/ZIP gốc không cần đưa vào repository. Khi đồng bộ `prebuilt/`, sao chép toàn bộ `dist/` để giữ đủ ảnh.

## Lưu thiệp PNG

Bản PNG được vẽ trực tiếp bằng Canvas để tránh lỗi mất ảnh và chồng chữ khi xuất qua SVG trên WebKit/Safari. Ảnh tải và giải mã đầy đủ trước khi vẽ; chữ được đo sau khi tải phông tiếng Việt, tự xuống dòng và dành chỗ riêng cho chữ ký. Kích thước canvas được giới hạn để tránh ảnh trắng khi lời chúc dài trên điện thoại.

Website chuẩn bị sẵn PNG sau khi mở thiệp; đợi nút lưu sẵn sàng rồi chọn:

- **Máy tính:** Chrome/Edge có hỗ trợ Save As cho phép chọn thư mục lưu. Firefox/Safari tải theo tùy chọn tải xuống của trình duyệt.
- **Điện thoại:** nếu trình duyệt hỗ trợ chia sẻ tệp PNG, nút lưu mở bảng chia sẻ của hệ thống. Chọn **Lưu hình ảnh / Save Image / Photos** nếu có; website không thể tự ghi ảnh vào thư viện Photos.
- Nếu chia sẻ không khả dụng hoặc không có mục lưu ảnh, chọn **Mở ảnh để lưu vào máy**. Hộp xem hiển thị PNG đầy đủ để nhấn giữ và lưu; cũng có thể chọn **Tải ảnh PNG** hoặc **Mở ảnh riêng**.

## Photobooth · mục 05

Mở `/#/photobooth`, chọn **Bật camera**, cho phép truy cập rồi chụp ba kiểu ảnh với đếm ngược. Khung PNG 1080 × 1920 (9:16) đặt **Digimar 66D** ở giữa phía trên, trang trí tim, nơ và hoa. Có thể chụp lại hoặc chọn ba ảnh có sẵn để ghép cùng khung. Bản xem trước và hộp lưu thu vừa toàn bộ ảnh theo màn hình điện thoại.

Bật **Ghi video cùng lượt chụp** trước khi chụp để lưu thêm video 720 × 1280 với hình camera liên tục, đếm ngược, ba ảnh đã chụp và hiệu ứng lóe sáng, tim, ngôi sao ở mỗi lần bấm máy. Nút **Lưu video** xuất MP4 nếu trình duyệt hỗ trợ, hoặc WebM. Video không thu âm; trình duyệt thiếu tính năng ghi vẫn chụp và lưu ảnh bình thường. Ảnh và video được xử lý ngay trên thiết bị, không gửi lên máy chủ. Camera chỉ bật sau thao tác của người xem và được tắt khi rời trang.

Nút lưu ảnh/video dùng file đã tạo sẵn: máy tính chọn nơi lưu hoặc tải file; điện thoại mở bảng chia sẻ nếu hỗ trợ, hoặc mở bản xem trước có nút tải. Trình duyệt quyết định vị trí và quyền lưu. Camera cần HTTPS trên bản triển khai hoặc localhost khi phát triển; kiểm thử dùng luồng video giả, không truy cập camera thật.

## Nhạc nền

Nút **Bật nhạc** dùng trình phát YouTube chính thức cho [bài nhạc được cung cấp](https://www.youtube.com/watch?v=oahyzTO6VFw), cấu hình bằng `siteConfig.musicYouTubeId` và `musicUrl`. Trình phát được giữ ngoài các trang chuyển động nên bài nhạc tiếp tục khi chuyển giữa năm mục, tự lặp khi kết thúc. Mở hộp xem video Boy Day tạm dừng nhạc; đóng hộp phát tiếp nếu người xem vẫn bật nhạc. Tắt nhạc hoặc rời trang thì dừng phát.

Trình duyệt có thể yêu cầu bấm **Phát nhạc** thêm một lần để cho phép âm thanh. Trạng thái đang phát chỉ hiển thị sau xác nhận từ YouTube; khi mạng hoặc video nhúng bị chặn, hiện thông báo thử lại và liên kết nghe trên YouTube. Kiểm thử tự động dùng API YouTube giả và clip thử riêng để kiểm tra vòng lặp, chuyển trang và phối hợp tạm dừng; không xác nhận khả năng phát video/nhạc từ dịch vụ thật. Mạng môi trường đám mây hiện chặn Google Drive và YouTube nên cần đối chiếu nguồn thật trên Preview từ mạng có thể truy cập hai dịch vụ.

## Deploy

Website đầy đủ được triển khai trên **Vercel**, chọn **Root Directory** là `dm66-website`, framework Vite, build `npm run build`, output `dist`. Các API Node trong `api/` được Vercel triển khai cùng giao diện; cần cấu hình ba biến server Supabase theo [hướng dẫn backend](supabase/README.md) và redeploy Preview sau khi lưu biến.

Bản thay đổi dùng **Vercel Preview riêng** để kiểm tra trước khi phát hành. Việc tạo Preview không cập nhật website production. Cấu hình Netlify cũ vẫn còn trong repository, nhưng chỉ phục vụ giao diện tĩnh; chưa có bản chuyển đổi API thư sang Netlify Functions.

Dự án dùng đường dẫn gốc `/`, phù hợp khi deploy ở tên miền hoặc subdomain riêng. Nếu phục vụ dưới một thư mục con, cần điều chỉnh `base` của Vite và các đường dẫn tài nguyên trước khi build.

Trước khi chia sẻ, chạy `npm test` và `npm run build`, rồi kiểm tra trên bản Preview:

- Cả năm trang, CTA và đường dẫn chia sẻ trực tiếp hoạt động trên máy tính, điện thoại.
- Tra cứu bằng tên có dấu/không dấu và mã sinh viên; thử sai tên, sai mã và tra cứu người khác.
- Xác nhận số lượng lời chúc, chọn từng lời và kiểm tra PNG khớp lời đang xem.
- Xác nhận thông báo số lượng trước khi mở từng lời, cả trường hợp chưa có lời chúc.
- Ảnh và lời chúc đúng người, nội dung không còn là dữ liệu mẫu.
- Thiệp PNG tải được, đủ chữ tiếng Việt và ảnh; nhạc bật/tắt được nếu đã cấu hình.
