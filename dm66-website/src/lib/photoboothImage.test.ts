import { describe, expect, it } from "vitest";
import { getPhotoboothCrop } from "./photoboothImage";

describe("photobooth camera crop", () => {
  it("keeps an already 4:3 camera frame intact", () => {
    expect(getPhotoboothCrop(640, 480)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it("removes equal amounts from both sides of a wide camera frame", () => {
    expect(getPhotoboothCrop(1920, 1080)).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
  });

  it("removes equal amounts above and below a portrait camera frame", () => {
    expect(getPhotoboothCrop(1080, 1920)).toEqual({ x: 0, y: 555, width: 1080, height: 810 });
  });

  it.each([[0, 480], [640, 0], [-1, 480], [640, -1], [NaN, 480], [640, Infinity]])(
    "rejects missing or invalid camera dimensions %sx%s",
    (width, height) => expect(() => getPhotoboothCrop(width, height)).toThrow(),
  );
});
