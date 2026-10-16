export interface Memory {
  id: string;
  title: string;
  date?: string;
  image: string;
  description: string;
  altText: string;
  isPlaceholder?: boolean;
}

// Thay ảnh và nội dung tại đây khi lớp cung cấp kỷ niệm thật.
// Ba mục dưới chỉ minh họa bố cục, không mô tả sự kiện đã diễn ra của DM66D.
export const memories: Memory[] = [
  {
    id: "memory-placeholder-01",
    title: "Một trang dành cho kỷ niệm của chúng mình",
    image: "/images/memories-placeholder.svg",
    description:
      "Đây là vị trí minh họa cho một bức ảnh của lớp Digital Marketing 66D. Khi có ảnh và câu chuyện thật, tên kỷ niệm, thời gian cùng những dòng chia sẻ sẽ được thêm vào trang album này.",
    altText: "Ảnh minh họa album với hoa và khung ảnh trống, chưa có ảnh kỷ niệm thật của lớp",
    isPlaceholder: true,
  },
  {
    id: "memory-placeholder-02",
    title: "Một khoảnh khắc đang chờ được kể",
    image: "/images/memories-placeholder.svg",
    description:
      "Trang album này đang chờ một hình ảnh do các bạn cung cấp. Những dòng chữ hiện tại là nội dung mẫu và sẽ được thay bằng câu chuyện gắn với chính bức ảnh đó.",
    altText: "Khung minh họa cho kỷ niệm thứ hai, đang chờ hình ảnh và câu chuyện của DM66D",
    isPlaceholder: true,
  },
  {
    id: "memory-placeholder-03",
    title: "Còn nhiều điều đẹp đẽ để lưu giữ",
    image: "/images/memories-placeholder.svg",
    description:
      "Một chỗ nhỏ nữa dành cho những hình ảnh mà lớp muốn lưu lại. Đây vẫn là trang mẫu; album sẽ có câu chuyện riêng khi chúng mình bổ sung những kỷ niệm thực tế.",
    altText: "Khung minh họa cho kỷ niệm thứ ba, chưa có hình ảnh thực tế của lớp",
    isPlaceholder: true,
  },
];
