# Dữ liệu thiệp kỷ niệm riêng

Dữ liệu bổ sung được lưu riêng trong `public/data/special-recipients.json` để không bị ghi đè khi nhập lại Excel của lớp. Không sửa 44 hồ sơ hiện có.

Lời chúc giữ nguyên cách viết, từ ngữ, lỗi gõ và biểu tượng cảm xúc người dùng cung cấp. Chỉ bỏ tiền tố `Dear Phương, ` khỏi phần thân vì thiệp hiển thị lời chào riêng; không thêm hoặc sửa nội dung.

- SHA-256 phần thân UTF-8: `0f82309adc2eeb7e4c53d174eb17c7ad35051fb05e5fa6e3ae7e90727eaa78be`.
- Số ký tự phần thân: 1906.
- 11 JPEG từ `tranphuong.zip`, tổng 3,343,826 byte, giữ nguyên từng byte.
- Ảnh được đánh số theo thứ tự tăng dần của tên file gốc. Ảnh bìa `photo-11.jpg` cho thấy rõ cả hai người; không cắt hoặc chỉnh nội dung ảnh.
- Mô tả thay thế chỉ đánh số ảnh trong album, không suy đoán sự kiện hoặc ngày chụp.
- Theo yêu cầu đổi vị trí trang trí, **Kỷ niệm 03** hiển thị `photo-11.jpg` và **Kỷ niệm 11** hiển thị `photo-03.jpg`. Kích thước metadata đi cùng ảnh; nhãn và mô tả thay thế giữ số vị trí hiển thị. Ảnh bìa của thiệp vẫn dùng `photo-11.jpg`; tên tệp và byte ảnh gốc trong bảng dưới không đổi.

| Ảnh xuất bản | Byte | SHA-256 giống file gốc trong ZIP |
| --- | ---: | --- |
| `photo-01.jpg` | 251790 | `8dfe487f19d326a87fb43cf0f37a7806510b493342c87adf57b913b8db6a50e9` |
| `photo-02.jpg` | 211459 | `401629c18a24e3b78693e3a3ea17531a4eb11e3bdd8ae12449346e5d0686730c` |
| `photo-03.jpg` | 523993 | `b34de203d27fdb82a7b57efc2537bea4c3490897be8f3a7ee256825cfd3555c7` |
| `photo-04.jpg` | 119543 | `d90b09ad57fbc1990a492d80de85b39baa558e66fb1e7ae45a3bdcd192b3b745` |
| `photo-05.jpg` | 699087 | `653e031544989ce48b7c7d1c57a2d0bc492ad560b27ba5c8816c1bf2aa3988e7` |
| `photo-06.jpg` | 168694 | `7f0da4d644b451eb1d47c5002727582488cca53a27ec054d260aae73ab446fc6` |
| `photo-07.jpg` | 233808 | `b4942a66e17e74b32a7f0f8c9cf4a9313d194b8d1c5459a70f77139bde308326` |
| `photo-08.jpg` | 309053 | `8e5efde00ab88e4bb7da6da75cc45fa3e8fe5d186a6ce5d462fb1fa27cbee2c0` |
| `photo-09.jpg` | 251475 | `4d18f6816d366dcad9cc8e15898a99f4240751a9e119da57acee5c1c96ccaaf9` |
| `photo-10.jpg` | 325769 | `f6939f0aaf72f46e0db8f22493d565b8e5882d157986a9abaaa786ce7691b0ae` |
| `photo-11.jpg` | 249155 | `5f74ff91cf06e7c12cd9640805ba583572c4a8e43773e00eab56f9ab6939824c` |
