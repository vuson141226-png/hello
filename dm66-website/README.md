# Chúc mừng 20/10 · Digital Marketing 66

Website lời chúc dành cho các bạn nữ Digital Marketing 66, xây dựng bằng React, TypeScript và Vite. Giao diện hỗ trợ điện thoại, tìm lời chúc theo tên hoặc biệt danh, tải thiệp PNG và nhạc nền tùy chọn.

Mã nguồn được giải nén từ `dm66-source.zip` vào thư mục `dm66-website/` trong repository, giữ nguyên chức năng của bản gốc. Thư mục `prebuilt/` lưu bản website tĩnh gốc được giải nén từ `dm66-website.zip`; nội dung đã được đối chiếu khớp từng byte với tệp ZIP. Đây là bản chụp tại thời điểm nhận, không tự cập nhật khi sửa mã nguồn. Lệnh `npm run build` tạo bản mới trong `dist/` (được Git bỏ qua), không ghi đè `prebuilt/`.

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

Ba trang dùng hash route: `/#/`, `/#/our-girls` và `/#/your-wish`. Khi chia sẻ đường dẫn trực tiếp, giữ nguyên phần `/#/...`.

## Thay dữ liệu và ảnh thật

Dữ liệu trong `src/data/girls.ts` là dữ liệu mẫu. Chưa có ảnh chân dung hay thông tin cá nhân thật được cung cấp. Hãy thay bằng nội dung được các bạn đồng ý sử dụng trước khi chia sẻ website.

1. Thêm ảnh vào `public/images/`, ví dụ `public/images/minh-anh.jpg`.
2. Sửa hoặc thêm đối tượng trong mảng `girls` của `src/data/girls.ts` theo kiểu `Girl` có sẵn: `id`, `fullName`, `displayName`, `nicknames`, `image`, `introduction`, `personality`, `wish`, cùng `memory` nếu có.
3. Đặt `image` thành đường dẫn từ gốc như `/images/minh-anh.jpg`, không thêm `public/`. Dùng tên tệp chữ thường, không dấu và không có khoảng trắng để tránh lỗi đường dẫn khi deploy.
4. Dùng `id` riêng cho từng người. Nhập đúng họ tên, tên hiển thị và các biệt danh; không tự tạo thông tin cá nhân. Đặt `isPlaceholder: false` sau khi đã thay nội dung mẫu.

Tìm kiếm chạy ngay trên trình duyệt, đối chiếu tên và biệt danh sau khi chuẩn hóa dấu, chữ hoa/thường và khoảng trắng; không đoán gần đúng. Nếu nhiều người có cùng tên hoặc biệt danh, người dùng chọn đúng người từ danh sách kết quả. Nên dùng tên và biệt danh đủ phân biệt để giảm nhầm lẫn.

**Dữ liệu tĩnh có thể được mọi khách truy cập đọc.** Trang lời chúc không phải khu vực bảo mật, dù khách cần tìm tên để mở thiệp. Không đưa bí mật, số điện thoại, địa chỉ hoặc nội dung riêng tư vào mã nguồn.

Ảnh trong `public/images/` được khuyến nghị cho chức năng tải PNG. Ảnh từ dịch vụ bên ngoài cần cho phép CORS; ảnh vẫn có thể hiển thị trên trang nhưng bị chặn khi xuất thiệp. Kiểm tra tải PNG trên bản đã deploy sau khi thay ảnh.

## Nhạc nền tùy chọn

Thêm tệp âm thanh có quyền sử dụng vào `public/audio/background.mp3`, rồi đặt `siteConfig.musicSrc` trong `src/config.ts` thành `/audio/background.mp3`. Giá trị mặc định `null` tắt tính năng nhạc.

Nhạc chỉ phát sau thao tác bật của người dùng; website không tự phát âm thanh. Kiểm tra cả thao tác bật và tắt trên điện thoại sau khi thêm tệp.

## Deploy

Kết nối repository trên GitHub với **Vercel** hoặc **Netlify**, rồi chọn thư mục dự án `dm66-website`. Hai tệp cấu hình trong thư mục này đã đặt lệnh build là `npm run build` và thư mục xuất bản là `dist`. Không cần máy chủ ứng dụng hay khóa API.

| Nền tảng | Thiết lập |
| --- | --- |
| Vercel | Import repository, đặt **Root Directory** là `dm66-website`, chọn framework Vite; dùng cấu hình `dm66-website/vercel.json`. Output Directory là `dist`. |
| Netlify | Import repository, đặt **Base directory** là `dm66-website`, dùng cấu hình `dm66-website/netlify.toml`. Build command là `npm run build`, Publish directory là `dist` tính từ Base directory. |

Dự án dùng đường dẫn gốc `/`, phù hợp khi deploy ở tên miền hoặc subdomain riêng. Nếu phục vụ dưới một thư mục con, cần điều chỉnh `base` của Vite và các đường dẫn tài nguyên trước khi build.

Trước khi chia sẻ, chạy `npm test` và `npm run build`, rồi kiểm tra trên bản production:

- Ba trang và đường dẫn chia sẻ trực tiếp hoạt động trên máy tính, điện thoại.
- Tìm bằng họ tên có dấu, không dấu và biệt danh; thử tên không tồn tại và tên trùng.
- Ảnh và lời chúc đúng người, nội dung không còn là dữ liệu mẫu.
- Thiệp PNG tải được, đủ chữ tiếng Việt và ảnh; nhạc bật/tắt được nếu đã cấu hình.
