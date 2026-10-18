import { describe, expect, it } from "vitest";
import { girls, type Girl } from "../data/girls";
import { findRecipients, normalizeName } from "./recipients";

// Synthetic examples used only by these tests, not real classmates.
const samples: Girl[] = [
  {
    id: "synthetic-01",
    fullName: "Mẫu Đặng Ánh 01",
    displayName: "Mẫu Ánh 01",
    nicknames: ["Mẫu Đậu", "Tên mẫu chung", "Mẫu Ánh 01"],
    image: "/images/portrait-placeholder.svg",
    introduction: "Dữ liệu mẫu kiểm thử.",
    personality: "Dữ liệu mẫu kiểm thử.",
    wish: "Dữ liệu mẫu kiểm thử.",
    isPlaceholder: true,
  },
  {
    id: "synthetic-02",
    fullName: "Mẫu Trần Bích 02",
    displayName: "Mẫu Bích 02",
    nicknames: ["Mẫu Mây", "Tên mẫu chung"],
    image: "/images/portrait-placeholder.svg",
    introduction: "Dữ liệu mẫu kiểm thử.",
    personality: "Dữ liệu mẫu kiểm thử.",
    wish: "Dữ liệu mẫu kiểm thử.",
    isPlaceholder: true,
  },
];

describe("normalizeName", () => {
  it("normalizes Vietnamese accents, uppercase Đ, and lowercase đ", () => {
    expect(normalizeName("ĐẶNG ĐỖ đậu")).toBe("dang do dau");
  });

  it("normalizes composed and decomposed Unicode equally", () => {
    expect(normalizeName("Mẫu Ánh".normalize("NFD"))).toBe("mau anh");
    expect(normalizeName("Mẫu Ánh")).toBe("mau anh");
  });

  it("trims and collapses whitespace, including nonbreaking spaces", () => {
    expect(normalizeName("  Mẫu\t Đặng\nÁnh\u00a0 01  ")).toBe(
      "mau dang anh 01",
    );
  });

  it("keeps punctuation significant", () => {
    expect(normalizeName("[Tên mẫu 01]")).toBe("[ten mau 01]");
  });
});

describe("findRecipients", () => {
  it.each(["Mẫu Đặng Ánh 01", "mau dang anh 01", "  MẪU   ĐẶNG ÁNH 01 "])(
    "matches the full name exactly after normalization: %s",
    (query) => {
      expect(findRecipients(query, samples)).toEqual([samples[0]]);
    },
  );

  it("matches display names and nicknames", () => {
    expect(findRecipients("mau bich 02", samples)).toEqual([samples[1]]);
    expect(findRecipients("MẪU ĐẬU", samples)).toEqual([samples[0]]);
  });

  it("returns all ambiguous matches in source order", () => {
    expect(findRecipients("ten mau chung", samples)).toEqual(samples);
  });

  it("returns a recipient only once when several aliases match", () => {
    expect(findRecipients("mau anh 01", samples)).toEqual([samples[0]]);
  });

  it.each(["", "   ", "\t\n", "Đặng", "Mẫu Ánh", "Mẫu Ánh 01!", "mau dauu"])(
    "does not use blank, partial, or fuzzy matches: %j",
    (query) => {
      expect(findRecipients(query, samples)).toEqual([]);
    },
  );

  it("does not treat recipient ids as names", () => {
    expect(findRecipients("synthetic-01", samples)).toEqual([]);
  });

  it("returns an empty array for an empty directory", () => {
    expect(findRecipients("mau dau", [])).toEqual([]);
  });

  it("does not match an empty query against an empty alias", () => {
    const sample = { ...samples[0], nicknames: [""] };
    expect(findRecipients("  ", [sample])).toEqual([]);
  });

  it("preserves original recipient objects without changing the directory", () => {
    const snapshot = structuredClone(samples);
    const [match] = findRecipients("mau dau", samples);

    expect(match).toBe(samples[0]);
    expect(samples).toEqual(snapshot);
  });

  it("ships no public recipient directory or private wishes", () => {
    expect(girls).toEqual([]);
  });

  it("returns every recipient sharing the same display name", () => {
    const sameDisplayName = samples.map((girl) => ({
      ...girl,
      displayName: "Tên hiển thị mẫu chung",
    }));
    expect(findRecipients("ten hien thi mau chung", sameDisplayName)).toEqual(
      sameDisplayName,
    );
  });
});
