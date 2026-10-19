import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadImage, downloadVideo, isMobileDevice, saveImage, saveVideo } from "./saveImage";

const file = new File(["image bytes"], "DM66D-card.png", { type: "image/png" });

function device(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    platform: "Linux x86_64",
    maxTouchPoints: 0,
    ...overrides,
  });
}

function mockDownload() {
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  const appendChild = vi.fn();
  const createObjectURL = vi.fn(() => "blob:card");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("document", {
    createElement: vi.fn(() => link),
    body: { appendChild },
  });
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  return { link, appendChild, createObjectURL, revokeObjectURL };
}

beforeEach(() => {
  device();
  vi.stubGlobal("window", { setTimeout });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("isMobileDevice", () => {
  it.each([
    { userAgentData: { mobile: true } },
    { userAgent: "Mozilla/5.0 (Linux; Android 15)" },
    { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" },
    { userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0)" },
    { userAgent: "Mozilla/5.0 (iPod touch)" },
    { platform: "MacIntel", maxTouchPoints: 5 },
  ])("recognizes phone and tablet devices: %j", (overrides) => {
    device(overrides);
    expect(isMobileDevice()).toBe(true);
  });

  it("keeps a desktop Mac on the desktop save flow", () => {
    device({ platform: "MacIntel", maxTouchPoints: 0 });
    expect(isMobileDevice()).toBe(false);
  });
});

describe("desktop saving", () => {
  it("opens the native picker immediately and reports saved only after close", async () => {
    let finishClose!: () => void;
    const closed = new Promise<void>((resolve) => { finishClose = resolve; });
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn(() => closed);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const picker = vi.fn().mockResolvedValue({ createWritable });
    vi.stubGlobal("window", { showSaveFilePicker: picker });

    const result = saveImage(file);
    expect(picker).toHaveBeenCalledExactlyOnceWith({
      suggestedName: file.name,
      types: [{ description: "Ảnh PNG", accept: { "image/png": [".png"] } }],
    });
    let settled = false;
    void result.then(() => { settled = true; });
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(write).toHaveBeenCalledExactlyOnceWith(file);
    expect(settled).toBe(false);
    finishClose();
    await expect(result).resolves.toBe("saved");
  });

  it("treats cancelling the picker as a silent cancellation", async () => {
    const picker = vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    await expect(saveImage(file)).resolves.toBe("cancelled");
  });

  it("offers a preview when the picker cannot open", async () => {
    vi.stubGlobal("window", {
      showSaveFilePicker: vi.fn().mockRejectedValue(new Error("Permission denied")),
    });
    await expect(saveImage(file)).resolves.toBe("preview");
  });

  it.each(["write", "close"])("discards a partial file when %s fails", async (failure) => {
    const abort = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    (failure === "write" ? write : close).mockRejectedValue(new Error("Disk full"));
    vi.stubGlobal("window", {
      showSaveFilePicker: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close, abort }),
      }),
    });
    await expect(saveImage(file)).resolves.toBe("preview");
    expect(abort).toHaveBeenCalledOnce();
    if (failure === "write") expect(close).not.toHaveBeenCalled();
  });

  it("still offers the preview if discarding a partial write also fails", async () => {
    vi.stubGlobal("window", {
      showSaveFilePicker: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockRejectedValue(new Error("Write failed")),
          close: vi.fn(),
          abort: vi.fn().mockRejectedValue(new Error("Abort failed")),
        }),
      }),
    });
    await expect(saveImage(file)).resolves.toBe("preview");
  });

  it("uses a browser download when the desktop picker is unavailable", async () => {
    const { link } = mockDownload();
    await expect(saveImage(file)).resolves.toBe("downloaded");
    expect(link.click).toHaveBeenCalledOnce();
  });
});

describe("mobile saving", () => {
  it("opens the native file share sheet immediately without extra text", async () => {
    let finishShare!: () => void;
    const share = vi.fn(() => new Promise<void>((resolve) => { finishShare = resolve; }));
    const canShare = vi.fn(() => true);
    device({ userAgentData: { mobile: true }, canShare, share });
    const result = saveImage(file);
    expect(canShare).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    expect(share).toHaveBeenCalledExactlyOnceWith({ files: [file] });
    finishShare();
    await expect(result).resolves.toBe("shared");
  });

  it("treats closing the native share sheet as cancellation", async () => {
    device({
      userAgent: "iPhone",
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    });
    await expect(saveImage(file)).resolves.toBe("cancelled");
  });

  it.each([
    {},
    { canShare: vi.fn(() => false), share: vi.fn() },
    { canShare: vi.fn(() => true) },
  ])("offers a preview when sharing files is unsupported: %j", async (overrides) => {
    device({ userAgent: "Android", ...overrides });
    await expect(saveImage(file)).resolves.toBe("preview");
    if ("share" in overrides) expect(overrides.share).not.toHaveBeenCalled();
  });

  it("offers a preview when canShare throws", async () => {
    const share = vi.fn();
    device({
      userAgent: "iPhone",
      canShare: vi.fn(() => { throw new TypeError("Not supported"); }),
      share,
    });
    await expect(saveImage(file)).resolves.toBe("preview");
    expect(share).not.toHaveBeenCalled();
  });

  it("offers a preview when the share sheet fails for a non-cancel reason", async () => {
    device({
      userAgent: "iPhone",
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(new DOMException("Blocked", "NotAllowedError")),
    });
    await expect(saveImage(file)).resolves.toBe("preview");
  });
});

describe("video saving", () => {
  it.each([
    ["video/mp4", "mp4", "Video MP4"],
    ["video/webm;codecs=vp8", "webm", "Video WebM"],
  ])("opens the picker immediately with the actual %s video format", async (mime, extension, description) => {
    const video = new File(["recorded video"], `Digimar66D-photobooth.${extension}`, { type: mime });
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const picker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue({ write, close }) });
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    const result = saveVideo(video);
    expect(picker).toHaveBeenCalledExactlyOnceWith({
      suggestedName: video.name,
      types: [{ description, accept: { [mime.split(";")[0]]: [`.${extension}`] } }],
    });
    await expect(result).resolves.toBe("saved");
    expect(write).toHaveBeenCalledExactlyOnceWith(video);
    expect(close).toHaveBeenCalledOnce();
  });

  it("shares the prepared video on the original mobile tap", async () => {
    const video = new File(["recorded video"], "Digimar66D-photobooth.mp4", { type: "video/mp4" });
    const share = vi.fn().mockResolvedValue(undefined);
    device({ userAgent: "iPhone", canShare: vi.fn(() => true), share });
    const result = saveVideo(video);
    expect(share).toHaveBeenCalledExactlyOnceWith({ files: [video] });
    await expect(result).resolves.toBe("shared");
  });

  it("offers preview for unsupported media without selecting a wrong extension", async () => {
    const picker = vi.fn();
    vi.stubGlobal("window", { showSaveFilePicker: picker });
    await expect(saveVideo(new File(["video"], "unknown.avi", { type: "video/avi" }))).resolves.toBe("preview");
    expect(picker).not.toHaveBeenCalled();
  });

  it("downloads the prepared video using its original filename", () => {
    vi.useFakeTimers();
    const video = new File(["recorded video"], "Digimar66D-photobooth.webm", { type: "video/webm" });
    const { link, createObjectURL } = mockDownload();
    downloadVideo(video);
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(video);
    expect(link.download).toBe(video.name);
    expect(link.click).toHaveBeenCalledOnce();
    vi.runAllTimers();
  });
});

describe("downloadImage", () => {
  it("downloads the named PNG and keeps its object URL alive until the browser starts reading", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout });
    const { link, appendChild, createObjectURL, revokeObjectURL } = mockDownload();
    downloadImage(file);
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(file);
    expect(link.href).toBe("blob:card");
    expect(link.download).toBe(file.name);
    expect(appendChild).toHaveBeenCalledExactlyOnceWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:card");
  });
});
