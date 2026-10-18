import { afterEach, describe, expect, it, vi } from "vitest";
import { findWishRecipient, loadRecipients, type WishRecipient } from "./recipientLookup";

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

describe("recipient data feeds", () => {
  afterEach(() => vi.unstubAllGlobals());

  const specialRecipient: WishRecipient = {
    ...recipients[0], id: "anniversary-sample", fullName: "Người yêu thử", studentCode: "SPECIAL-TEST",
    anniversary: { kind: "one-month", images: [{ src: "/test-photo.svg", altText: "Ảnh kỷ niệm thử" }] },
  };

  function mockFeeds(ordinary: unknown, special: unknown) {
    const fetchMock = vi.fn(async (url: string) => Response.json(url === "/data/special-recipients.json" ? special : ordinary));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("combines the ordinary and special feeds without changing their records", async () => {
    const before = structuredClone([recipients, specialRecipient]);
    const fetchMock = mockFeeds(recipients, [specialRecipient]);
    const result = await loadRecipients();
    expect(result).toEqual([...recipients, specialRecipient]);
    expect(result[2].anniversary?.images[0].altText).toBe("Ảnh kỷ niệm thử");
    expect([recipients, specialRecipient]).toEqual(before);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/data/recipient-wishes.json", "/data/special-recipients.json"]);
  });

  it("accepts an empty special feed for ordinary class wishes", async () => {
    mockFeeds(recipients, []);
    expect(await loadRecipients()).toEqual(recipients);
  });

  it.each(["/data/recipient-wishes.json", "/data/special-recipients.json"])("rejects an unsuccessful %s response instead of silently losing recipients", async (failedUrl) => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === failedUrl
      ? new Response("Unavailable", { status: 503 }) : Response.json([])));
    await expect(loadRecipients()).rejects.toThrow("Could not load wishes");
  });

  it.each([
    { kind: "other", images: [] },
    { kind: "one-month", images: null },
    { kind: "one-month", images: [null] },
    { kind: "one-month", images: [{ src: "/test.svg" }] },
    { kind: "one-month", images: [{ src: 42, altText: "Ảnh thử" }] },
  ])("rejects malformed anniversary metadata %#", async (anniversary) => {
    mockFeeds(recipients, [{ ...specialRecipient, anniversary }]);
    await expect(loadRecipients()).rejects.toThrow("Invalid wish data");
  });

  it.each([null, { recipients: [] }, [{ fullName: "Tên thử", studentCode: 123, wishes: [] }]])("rejects malformed feed records %#", async (special) => {
    mockFeeds(recipients, special);
    await expect(loadRecipients()).rejects.toThrow("Invalid wish data");
  });

  it("passes the same abort signal to both downloads and propagates cancellation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = loadRecipients(controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => init?.signal === controller.signal)).toBe(true);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
