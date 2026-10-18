export interface MemoryImage {
  src: string;
  altText: string;
  isPlaceholder?: boolean;
}

export interface Memory {
  id: string;
  title: string;
  date?: string;
  images: MemoryImage[];
  description: string;
}

// Imported from the class workbook; keep the original descriptions intact.
export const memories: Memory[] = [
  {
    "id": "ky-niem-01",
    "title": "Gặp gỡ đầu năm",
    "images": [
      {
        "src": "/images/memories/daunam1.jpg",
        "altText": "Gặp gỡ đầu năm — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/daunam2.jpg",
        "altText": "Gặp gỡ đầu năm — ảnh kỷ niệm 2"
      }
    ],
    "description": "Đây là lần gặp chính thức đầu tiên của lớp mình, lúc này chắc mọi người vẫn còn bỡ ngỡ lắm=))).  Nhưng khi sau khi chụp ảnh chung cùng nhau rồi đi TocoToco thì mọi người cũng đã thoải mái hơn hẳn. Haizz nhớ lại cảm giác được làm quen, tìm hiểu, trò chuyện cùng các thành viên lại thấy bồi hồi làm sao=))"
  },
  {
    "id": "ky-niem-02",
    "title": "First 20/10",
    "images": [
      {
        "src": "/images/memories/201020241.jpg",
        "altText": "First 20/10 — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/201020242.jpg",
        "altText": "First 20/10 — ảnh kỷ niệm 2"
      }
    ],
    "description": "Oh wowowowowowo first time lần đầu tiên tổ chức ngày cho các bạn nữ nè, lần đầu có một chút bối rối vì cũng vừa mới quen các bạn nên cũng chưa biết phải tổ chức như thế nào nhưng mà trộm vía là thành công phổng mũi tự hào 😤"
  },
  {
    "id": "ky-niem-03",
    "title": "Ngày hội vui vẻ",
    "images": [
      {
        "src": "/images/memories/teambuilding1.jpg",
        "altText": "Ngày hội vui vẻ — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/teambuilding2.jpg",
        "altText": "Ngày hội vui vẻ — ảnh kỷ niệm 2"
      }
    ],
    "description": "Đây là khi lớp mình cùng nhau tham gia một hoạt động của Khoa, chơi team building, biểu diễn văn nghệ, nhảy Blackpink và giành được giải Tập Thể Lớp Xuất Sắc Nhất. Từ buổi trải nghiệm thú vị này mà lớp mình đã trở nên vô cùng gắn kết cũng như tạo được rất nhiều tiếng cười và kỉ niệm đẹp❤️"
  },
  {
    "id": "ky-niem-04",
    "title": "First Boy Day",
    "images": [
      {
        "src": "/images/memories/boyday20241.jpg",
        "altText": "First Boy Day — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/boyday20242.jpg",
        "altText": "First Boy Day — ảnh kỷ niệm 2"
      }
    ],
    "description": "Đây là lần đầu các bạn nữ tổ chức ngày kỉ niệm Boy Day cho các bạn nam. Nói thật ngày hôm ấy bọn mình đã rất bất ngờ vì sự cute, tình cảm và sự quan tâm của các bạn lại lớn đến vậy.  Những cảm xúc và những món quà đặc biệt ngày hôm ấy cũng là tiền đề để bọn mình nỗ lực làm ra những ngày 8/3 và 20/10 đẳng cấp hơn sau này dành cho các chị e=)))."
  },
  {
    "id": "ky-niem-05",
    "title": "First 08/03",
    "images": [
      {
        "src": "/images/memories/080320251.jpg",
        "altText": "First 08/03 — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/080320252.jpg",
        "altText": "First 08/03 — ảnh kỷ niệm 2"
      }
    ],
    "description": "Wow cái 8/3 đầu tiên mà bọn mình tổ chức cho các bạn nữ 66D. Công nhận hôm đấy mặt bọn mình cũng thuộc dạng dày khi giăng cái Banner ở ngay lan can hành lang A2 cho các bạn ngắm=))). Bọn mình rất vui vì lần đầu tổ chức 8/3 nhưng được các bạn rất hào hứng đón nhận."
  },
  {
    "id": "ky-niem-06",
    "title": "CNXHKH cô Thuận",
    "images": [
      {
        "src": "/images/memories/cnxhkh1.jpg",
        "altText": "CNXHKH cô Thuận — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/cnxhkh2.jpg",
        "altText": "CNXHKH cô Thuận — ảnh kỷ niệm 2"
      }
    ],
    "description": "Đây là ảnh lớp mình với cô Thuận cute môn CNXHKH nha, hôm đấy nhóm nào cũng thuyết trình hay và được cô trao giải nữa =)))"
  },
  {
    "id": "ky-niem-07",
    "title": "Boy Day 2025",
    "images": [
      {
        "src": "/images/memories/boyday20251.jpg",
        "altText": "Boy Day 2025 — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/boyday20252.jpg",
        "altText": "Boy Day 2025 — ảnh kỷ niệm 2"
      }
    ],
    "description": "Chớp mắt một cái là đã đến Boy Day tiếp theo rồi, như những lần trước thì bọn mình cũng vô cùng bất ngờ với những món quà và tình cảm của các bạn nữ 66D. Thực sự tình yêu thương và những món quà đó đã sưởi ấm trái tim chúng mình khỏi cái lạnh giá của mùa đông năm ấy 💕"
  },
  {
    "id": "ky-niem-08",
    "title": "2 ngày 1 đêm đầu tiênnn",
    "images": [
      {
        "src": "/images/memories/2n1d1.jpg",
        "altText": "2 ngày 1 đêm đầu tiênnn — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/2n1d2.jpg",
        "altText": "2 ngày 1 đêm đầu tiênnn — ảnh kỷ niệm 2"
      }
    ],
    "description": "Uồi đi với nhau như này mà đã đi uống với lớp r á, chắc không có gì đâu uống chắc bàn với nhau thôi, đó là suy nghĩ ban đầu của tui NHƯNG thật crazy khi mọi người tiến sang bàn khác để cụng ly uống với nhau, tự dưng thấy lớp mình các bạn nữ thật lì lợm và dễ thương at the same time khi các bạn say rồi vẫn cố uống cho bằng được"
  },
  {
    "id": "ky-niem-09",
    "title": "Year end party!",
    "images": [
      {
        "src": "/images/memories/yep1.jpg",
        "altText": "Year end party! — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/yep2.jpg",
        "altText": "Year end party! — ảnh kỷ niệm 2"
      }
    ],
    "description": "Buổi YEP đầu tiên của lớp mình-một buổi tối siêu vui và đáng nhớee Sau chuyến đi 2N1Đ, cả lớp bắt đầu thân thiết, cởi mở và nói chuyện với nhau nhiều hơn, nên đến buổi YEP này, mọi người chắc cũng thoải mái với nhau nhiều hơn=)). Ai cũng vui vẻ, quậy hết mình, cùng ăn uống, trò chuyện và tạo nên biết bao khoảnh khắc đáng iu. Một buổi tối ngập tràn tiếng cười, đánh dấu thêm một chiếc kỷ niệm thật đẹp trong hành trình thanh xuân của chúng mình!"
  },
  {
    "id": "ky-niem-10",
    "title": "Buscom cùng Trần Việt An",
    "images": [
      {
        "src": "/images/memories/buscom1.jpg",
        "altText": "Buscom cùng Trần Việt An — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/buscom2.jpg",
        "altText": "Buscom cùng Trần Việt An — ảnh kỷ niệm 2"
      }
    ],
    "description": "Đây là ảnh lớp mình chụp với thầy Trần Việt An môn BusCom nè! Không ngờ thầy An lại nghĩ ra hình thức thuyết trình vô cùng sáng tạo như vậy và lớp mình cũng rất giỏi và tài năng nữa. Hai ngày thuyết trình của môn BusCom có lẽ sẽ trở thành những kí ức khó phai nhất của tập thể 66D (tiếc là mình ko đc lên VTV haizz)."
  },
  {
    "id": "ky-niem-11",
    "title": "NLPR cô Mai Lê",
    "images": [
      {
        "src": "/images/memories/pr1.jpg",
        "altText": "NLPR cô Mai Lê — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/pr2.jpg",
        "altText": "NLPR cô Mai Lê — ảnh kỷ niệm 2"
      }
    ],
    "description": "Nguyên lý Quan hệ công chúng cùng cô Mai Lê - người cô siu siu dễ thương và đáng iu  Cô giảng bài siêu haylúc nào cũng mang đến năng lượng tích cực, lại còn cực kỳ hào phóng khi cho các nhóm những điểm số thật xinhhh. Đây chắc chắn là môn học có những buổi thuyết trình sáng tạo, thú vị và đáng nhớ nhất trong suốt 2 năm đầu đại học của chúng mình. Iu cô Mai Lê siêu siêu nhiềuuu! 🫶🏻🌷"
  },
  {
    "id": "ky-niem-12",
    "title": "08/03/2026",
    "images": [
      {
        "src": "/images/memories/080320261.jpg",
        "altText": "08/03/2026 — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/080320262.jpg",
        "altText": "08/03/2026 — ảnh kỷ niệm 2"
      }
    ],
    "description": "Ngày 8/3 đầu tiên của 66D với lớp, ban đầu còn nghĩ là chắc tặng quà gì đó nhưng mà lúc đó đã có idea bánh có khuôn mặt mọi người và một chiếc banner siêu sến. Trộm vía là may thay tui đã kịp nhớ hết khuôn mặt đến tóc tai của các bạn nên khi thấy cái bánh đó các bạn chụp lên up str tui thích lắm phổng mũi tự hào lần 2 và lại thêm một kỷ niệm nữa với lớp D"
  },
  {
    "id": "ky-niem-13",
    "title": "Boy Day 2026",
    "images": [
      {
        "src": "/images/memories/boyday20261.jpg",
        "altText": "Boy Day 2026 — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/boyday20262.jpg",
        "altText": "Boy Day 2026 — ảnh kỷ niệm 2"
      }
    ],
    "description": "Thế là đến Boy Day 2026 rồi đây!! Thực sự một lần nữa các bạn lại làm bọn mình bất ngờ khi tổ chức ngay tại phòng máy môn CSLT. Và bọn mình bất ngờ hơn nữa khi các bạn còn cùng nhau quay MV ở trường nữa chứ=))), quá dễ thương rồi. Không chỉ thế mà còn là bánh ngọt với những chiếc gối siêu êm nữa. Bọn mình vẫn ôm gối đó ngủ và còn đem đi Xuho nữa đó nha=))))!!! 💕💕"
  },
  {
    "id": "ky-niem-14",
    "title": "Xiuuho",
    "images": [
      {
        "src": "/images/memories/xuho1.jpg",
        "altText": "Xiuuho — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/xuho2.jpg",
        "altText": "Xiuuho — ảnh kỷ niệm 2"
      }
    ],
    "description": "Xuhoho-một trong những kỷ niệm đẹp và đáng nhớ nhất trong suốt 4 năm đại học của chúng ta. Gần 1 tháng được ăn, chơi vô lo vô nghĩ và ở cùng nhau =))) . Nhớ những buổi tối sinh hoạt, ngồi bonding tâm sự đủ thứ chuyện trên đời, những ván bài ăn tiền, hay những lần lẻn ra ban công ngồi nói chuyện. Rồi cả những ngày bị thầy Trọng phạt, phải đứng giữa trưa nắng gấp chăn cùng bạn học Nông. Dù những ngày đầu có hơi khó khăn, vất vả và nhiều lúc chỉ mong nhanh nhanh được về, nhưng càng về sau lại càng thấy vui, càng thân nhau hơn và đến lúc kết thúc thì chẳng nỡ rời đi. Từ sau nhữn buổi 2n1d với yep lớp cho đến kì học học xuho lớp càng trở nên vui vẻ thân với nhau nhiều hơn ấy=)) vô cùng trân trọng những kỷ niệm ở xuho này"
  },
  {
    "id": "ky-niem-15",
    "title": "Lẩu Phann",
    "images": [
      {
        "src": "/images/memories/lauphan1.jpg",
        "altText": "Lẩu Phann — ảnh kỷ niệm 1"
      },
      {
        "src": "/images/memories/lauphan2.jpg",
        "altText": "Lẩu Phann — ảnh kỷ niệm 2"
      }
    ],
    "description": "Và đã đến buổi bonding gần nhất của lớp rồi, thời gian trôi nhanh quá mà haizzz. Sau khi đi xuho về ai cũng háo hức để có một buổi đi ăn với nhau, thế là buổi Lẩu Phan đó đã xuất hiện như một lẽ tất yếu=)). Vẫn còn nhớ lớp mình lúc đấy còn 3 môn thi cuối kì chưa xong mà đã kéo nhau đi ăn rồi=))). Hôm đấy thực sự rất vui, mọi người lại có thêm dịp được tâm sự cùng nhau và ôn lại những kỉ niệm đã qua nữa. Mong rằng lớp mình sẽ có thêm nhiều buổi đi ăn đi chơi như thế này để tình cảm của tập thể 66D ngày càng trở nên bền chặt và gắn kết nhaa!"
  }
];
