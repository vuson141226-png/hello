export interface Girl {
  id: string;
  fullName: string;
  displayName: string;
  nicknames: string[];
  image: string;
  introduction: string;
  personality: string;
  memory?: string;
  wish: string;
  isPlaceholder?: boolean;
}

/**
 * Nội dung mẫu để thử trải nghiệm. Thay bằng thông tin và ảnh đã được
 * người nhận đồng ý chia sẻ trước khi gửi website cho lớp.
 */
export const girls: Girl[] = [
  {
    id: "placeholder-01",
    fullName: "[Họ và tên bạn nữ 01]",
    displayName: "[Tên bạn nữ 01]",
    nicknames: ["mau 01", "demo 01"],
    image: "/images/portrait-placeholder.svg",
    introduction:
      "Nội dung mẫu — thay đoạn này bằng lời giới thiệu riêng dành cho bạn nữ 01.",
    personality:
      "Nội dung mẫu — thêm một nét tính cách có thật mà cả lớp yêu mến ở người nhận.",
    memory:
      "Nội dung mẫu — kể một kỷ niệm chung đã được người nhận đồng ý chia sẻ.",
    wish: "Lời chúc mẫu — viết lời chúc 20/10 chân thành của Digital Marketing 66 dành riêng cho bạn nữ 01 tại đây.",
    isPlaceholder: true,
  },
  {
    id: "placeholder-02",
    fullName: "[Họ và tên bạn nữ 02]",
    displayName: "[Tên bạn nữ 02]",
    nicknames: ["mau 02", "demo 02"],
    image: "/images/portrait-placeholder.svg",
    introduction:
      "Nội dung mẫu — thay đoạn này bằng lời giới thiệu riêng dành cho bạn nữ 02.",
    personality:
      "Nội dung mẫu — thêm một nét tính cách có thật mà cả lớp yêu mến ở người nhận.",
    memory:
      "Nội dung mẫu — kể một kỷ niệm chung đã được người nhận đồng ý chia sẻ.",
    wish: "Lời chúc mẫu — viết lời chúc 20/10 chân thành của Digital Marketing 66 dành riêng cho bạn nữ 02 tại đây.",
    isPlaceholder: true,
  },
  {
    id: "placeholder-03",
    fullName: "[Họ và tên bạn nữ 03]",
    displayName: "[Tên bạn nữ 03]",
    nicknames: ["mau 03", "demo 03"],
    image: "/images/portrait-placeholder.svg",
    introduction:
      "Nội dung mẫu — thay đoạn này bằng lời giới thiệu riêng dành cho bạn nữ 03.",
    personality:
      "Nội dung mẫu — thêm một nét tính cách có thật mà cả lớp yêu mến ở người nhận.",
    memory:
      "Nội dung mẫu — kể một kỷ niệm chung đã được người nhận đồng ý chia sẻ.",
    wish: "Lời chúc mẫu — viết lời chúc 20/10 chân thành của Digital Marketing 66 dành riêng cho bạn nữ 03 tại đây.",
    isPlaceholder: true,
  },
];
