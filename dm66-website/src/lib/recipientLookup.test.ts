import { describe, expect, it } from "vitest";
import { findWishRecipient, type WishRecipient } from "./recipientLookup";

const recipients: WishRecipient[] = [
  { id: "sample-01", fullName: "Mẫu Đặng Ánh", displayName: "Ánh", studentCode: "0012-AB", image: "/images/portrait-placeholder.svg", introduction: "", personality: "", wishes: [
    { id: "wish-01", title: "Lời chúc thử", senderName: "Người gửi thử", message: "Chúc cậu một ngày vui." },
    { id: "wish-02", title: "Lời chúc thử 2", senderName: "Người gửi thử 2", message: "Chúc cậu luôn vui." },
  ] },
  { id: "sample-02", fullName: "Mẫu Đặng Ánh", displayName: "Ánh", studentCode: "0013-AB", image: "/images/portrait-placeholder.svg", introduction: "", personality: "", wishes: [] },
];

describe("spreadsheet recipient lookup", () => {
  it("matches the full Vietnamese name with accents, case, and spacing normalized", () => {
    expect(findWishRecipient("  MAU  DANG ANH ", " 0012-ab ", recipients)).toBe(recipients[0]);
    expect(findWishRecipient("Mẫu Đặng Ánh".normalize("NFD"), "0012-AB", recipients)).toBe(recipients[0]);
  });

  it("requires both the full name and the student code", () => {
    for (const [name, code] of [["", "0012-AB"], ["Mẫu Đặng Ánh", ""], ["  ", " "], ["Mẫu Đặng Ánh", "WRONG"], ["Mẫu Đặng", "0012-AB"], ["Ánh", "0012-AB"]])
      expect(findWishRecipient(name, code, recipients)).toBeUndefined();
  });

  it("uses the code to select between people with the same full name", () => {
    expect(findWishRecipient("Mẫu Đặng Ánh", "0013-AB", recipients)).toBe(recipients[1]);
  });

  it("preserves leading zeroes and does not partially match student codes", () => {
    expect(findWishRecipient("Mẫu Đặng Ánh", "12-AB", recipients)).toBeUndefined();
    expect(findWishRecipient("Mẫu Đặng Ánh", "0012", recipients)).toBeUndefined();
  });

  it("preserves all wishes and the original source records", () => {
    const snapshot = structuredClone(recipients);
    expect(findWishRecipient("Mẫu Đặng Ánh", "0012-AB", recipients)?.wishes).toHaveLength(2);
    expect(recipients).toEqual(snapshot);
  });

  it("supports empty directories and recipients without wishes", () => {
    expect(findWishRecipient("Mẫu Đặng Ánh", "0012-AB", [])).toBeUndefined();
    expect(findWishRecipient("Mẫu Đặng Ánh", "0013-AB", recipients)?.wishes).toEqual([]);
  });
});
