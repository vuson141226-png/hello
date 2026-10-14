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
 * Dữ liệu thử do người dùng cung cấp trong DM66-data-template.xlsx,
 * chỉ lấy sheet DANH SACH, các dòng 7–12; không nhập sheet VI DU.
 * Nội dung được giữ nguyên. Chưa có ảnh nên dùng ảnh mẫu;
 * ô giới thiệu/lời chúc chưa điền giữ chuỗi trống để giao diện báo đang chuẩn bị.
 */
export const girls: Girl[] = [
  {
    id: "dm66-001",
    fullName: "ABC",
    displayName: "1",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "",
    personality: "",
    memory: "",
    wish: "",
    isPlaceholder: true,
  },
  {
    id: "dm66-002",
    fullName: "ABE",
    displayName: "1",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "assssssssssssssss",
    personality: "",
    memory: "",
    wish: "cảm ớndsa",
    isPlaceholder: true,
  },
  {
    id: "dm66-003",
    fullName: "ABA",
    displayName: "3",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    personality: "",
    memory: "",
    wish: "ádsvfdffds",
    isPlaceholder: true,
  },
  {
    id: "dm66-004",
    fullName: "ABZ",
    displayName: "4",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    personality: "",
    memory: "",
    wish: "ádsssssssssssssssss",
    isPlaceholder: true,
  },
  {
    id: "dm66-005",
    fullName: "ABQ",
    displayName: "5",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    personality: "",
    memory: "",
    wish: "dấdaasdada",
    isPlaceholder: true,
  },
  {
    id: "dm66-006",
    fullName: "ABD",
    displayName: "6",
    nicknames: [],
    image: "/images/portrait-placeholder.svg",
    introduction: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    personality: "",
    memory: "",
    wish: "ffffffffffffffffffffffff",
    isPlaceholder: true,
  },
];
