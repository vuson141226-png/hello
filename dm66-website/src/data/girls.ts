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
 * Năm hồ sơ thử có ảnh do người dùng cung cấp trong DM66-data-template.xlsx
 * và anh.zip: chỉ lấy DANH SACH, dòng 8–12. Dòng ABC thiếu ảnh không hiển thị.
 * Ghép theo tên ban1…ban5, giữ nguyên nội dung và ID đã có.
 * ban1 và ban5 dùng bản PNG đã che thông tin theo yêu cầu; không lưu ảnh gốc.
 */
export const girls: Girl[] = [
  {
    "id": "dm66-002",
    "fullName": "ABE",
    "displayName": "1",
    "nicknames": [],
    "image": "/images/girls/ban1.png",
    "introduction": "assssssssssssssss",
    "personality": "",
    "memory": "",
    "wish": "cảm ớndsa",
    "isPlaceholder": false
  },
  {
    "id": "dm66-003",
    "fullName": "ABA",
    "displayName": "3",
    "nicknames": [],
    "image": "/images/girls/ban2.jpg",
    "introduction": "aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "personality": "",
    "memory": "",
    "wish": "ádsvfdffds",
    "isPlaceholder": false
  },
  {
    "id": "dm66-004",
    "fullName": "ABZ",
    "displayName": "4",
    "nicknames": [],
    "image": "/images/girls/ban3.jpg",
    "introduction": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "personality": "",
    "memory": "",
    "wish": "ádsssssssssssssssss",
    "isPlaceholder": false
  },
  {
    "id": "dm66-005",
    "fullName": "ABQ",
    "displayName": "5",
    "nicknames": [],
    "image": "/images/girls/ban4.jpg",
    "introduction": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "personality": "",
    "memory": "",
    "wish": "dấdaasdada",
    "isPlaceholder": false
  },
  {
    "id": "dm66-006",
    "fullName": "ABD",
    "displayName": "6",
    "nicknames": [],
    "image": "/images/girls/ban5.png",
    "introduction": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "personality": "",
    "memory": "",
    "wish": "ffffffffffffffffffffffff",
    "isPlaceholder": false
  }
];
