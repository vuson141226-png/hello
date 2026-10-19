import { getPhotoboothCrop, PHOTOBOOTH_SHOTS } from "./photoboothImage";

const WIDTH = 720;
const HEIGHT = 1280;
const ROSE = "#b76589";
const FRAME = { x: 50, y: 252, width: 620, height: 465 };
const EFFECT_DURATION = 1100;

export interface PhotoboothVideoSession {
  updateCountdown: (count: number | null, pose: number) => void;
  markShot: (image: string) => void;
  finish: () => Promise<File | null>;
  cancel: () => void;
}

/** Only the camera's video is used. Recording never asks for a microphone. */
export function supportsPhotoboothVideo(): boolean {
  return typeof MediaRecorder !== "undefined"
    && typeof HTMLCanvasElement !== "undefined"
    && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-25, -6, -11, -24, 0, -11);
  ctx.bezierCurveTo(11, -24, 25, -6, 0, 10);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(2, -2, size * 0.65, 0);
  ctx.quadraticCurveTo(2, 2, 0, size);
  ctx.quadraticCurveTo(-2, 2, -size * 0.65, 0);
  ctx.quadraticCurveTo(-2, -2, 0, -size);
  ctx.fillStyle = "#d8ae75";
  ctx.fill();
  ctx.restore();
}

/** A decorated, portrait recording with shutter effects painted into every video frame. */
export function startPhotoboothVideo(
  video: HTMLVideoElement,
  options: { onError: () => void },
): PhotoboothVideoSession {
  if (!supportsPhotoboothVideo()) throw new Error("Video recording is unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas recording is unavailable");

  let raf = 0;
  let countdown: number | null = 3;
  let pose = 0;
  let lastShutter = -Infinity;
  let completed = 0;
  let disposed = false;
  let discard = false;
  let stopped = false;
  let stopTimer: number | undefined;
  const photos: HTMLImageElement[] = [];
  const chunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let resolveFile: (file: File | null) => void = () => undefined;
  const finished = new Promise<File | null>((resolve) => { resolveFile = resolve; });

  const cleanup = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((track) => track.stop());
    photos.forEach((image) => { image.onload = null; image.onerror = null; });
  };

  const complete = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(stopTimer);
    cleanup();
    const mime = recorder?.mimeType || chunks.find((chunk) => chunk.type)?.type || "video/webm";
    const blob = new Blob(chunks, { type: mime });
    chunks.length = 0;
    if (discard || !blob.size || !/^video\/(?:mp4|webm)(?:;|$)/i.test(mime)) {
      if (!discard) options.onError();
      resolveFile(null);
      return;
    }
    const extension = /^video\/mp4(?:;|$)/i.test(mime) ? "mp4" : "webm";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    resolveFile(new File([blob], `digimar-66d-photobooth-${stamp}.${extension}`, { type: mime }));
  };

  const cancel = () => {
    discard = true;
    window.clearTimeout(stopTimer);
    chunks.length = 0;
    cleanup();
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); }
    catch { /* A failed recorder can still release its canvas tracks. */ }
    resolveFile(null);
  };

  const fail = () => {
    if (discard || stopped) return;
    options.onError();
    cancel();
  };

  const draw = (now: number) => {
    ctx.fillStyle = "#fff6f1";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#dfb3c4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(15, 15, WIDTH - 30, HEIGHT - 30, 26);
    ctx.stroke();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = "#ebccd7";
    ctx.strokeRect(29, 29, WIDTH - 58, HEIGHT - 58);
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.fillStyle = ROSE;
    ctx.font = '600 82px "Dancing Script", cursive';
    ctx.fillText("Digimar 66D", WIDTH / 2, 157, WIDTH - 115);
    heart(ctx, 76, 104, 17, "#e5b4c7");
    heart(ctx, WIDTH - 72, 168, 21, "#e5b4c7");
    star(ctx, 108, 187, 11);
    star(ctx, WIDTH - 104, 85, 12);

    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(FRAME.x - 9, FRAME.y - 9, FRAME.width + 18, FRAME.height + 44);
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const crop = getPhotoboothCrop(video.videoWidth, video.videoHeight);
      ctx.save();
      ctx.translate(FRAME.x + FRAME.width, FRAME.y);
      ctx.scale(-1, 1);
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, FRAME.width, FRAME.height);
      ctx.restore();
    }
    ctx.strokeStyle = "#e4bfcd";
    ctx.strokeRect(FRAME.x - 9, FRAME.y - 9, FRAME.width + 18, FRAME.height + 44);

    if (countdown !== null) {
      ctx.fillStyle = "#38233328";
      ctx.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
      ctx.save();
      ctx.shadowColor = "#482d3c70";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#fffafa";
      ctx.font = '500 122px "Be Vietnam Pro", sans-serif';
      ctx.fillText(String(countdown), WIDTH / 2, FRAME.y + FRAME.height / 2 + 39);
      ctx.restore();
    }
    ctx.fillStyle = "#a06f84";
    ctx.font = '400 17px "Be Vietnam Pro", sans-serif';
    ctx.fillText(`KIỂU ${Math.min(pose + 1, PHOTOBOOTH_SHOTS)} / ${PHOTOBOOTH_SHOTS}`, WIDTH / 2, 741);

    for (let index = 0; index < PHOTOBOOTH_SHOTS; index += 1) {
      const x = 66 + index * 203;
      const y = 854 + (index === 1 ? -9 : 0);
      ctx.save();
      ctx.translate(x + 91, y + 83);
      ctx.rotate((index - 1) * 0.035);
      ctx.fillStyle = "#fffdf9";
      ctx.fillRect(-94, -77, 188, 170);
      ctx.strokeStyle = index < completed ? "#cb8aa7" : "#e6cbd5";
      ctx.strokeRect(-94, -77, 188, 170);
      const image = photos[index];
      if (image?.complete && image.naturalWidth) ctx.drawImage(image, -87, -70, 174, 130.5);
      else {
        ctx.fillStyle = "#f6e5ec";
        ctx.fillRect(-87, -70, 174, 130.5);
        heart(ctx, 0, -4, 19, "#ddb4c6");
      }
      ctx.font = '400 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "#ae7a91";
      ctx.fillText(String(index + 1).padStart(2, "0"), 0, 81);
      ctx.restore();
    }
    ctx.fillStyle = ROSE;
    ctx.font = '500 41px "Dancing Script", cursive';
    ctx.fillText(completed === PHOTOBOOTH_SHOTS ? "Ba khoảnh khắc, thật nhiều niềm vui ♡" : "Mỉm cười, cậu luôn thật đáng yêu ♡", WIDTH / 2, 1113, WIDTH - 90);
    ctx.font = '500 29px "Dancing Script", cursive';
    ctx.fillText("made with love", WIDTH / 2, 1190);
    heart(ctx, 113, 1160, 17, "#dab0c1");
    heart(ctx, 607, 1172, 22, "#dab0c1");
    star(ctx, 80, 1093, 13);
    star(ctx, 637, 1080, 14);

    const effect = (now - lastShutter) / EFFECT_DURATION;
    if (effect >= 0 && effect < 1) {
      // The flash and burst are part of the encoded canvas, not an HTML overlay.
      if (effect < 0.2) {
        ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - effect / 0.2)})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - effect) * 2.2);
      for (let index = 0; index < 16; index += 1) {
        const angle = (index / 16) * Math.PI * 2 + completed * 0.19;
        const radius = 90 + effect * (220 + (index % 3) * 36);
        const x = WIDTH / 2 + Math.cos(angle) * radius;
        const y = FRAME.y + FRAME.height / 2 + Math.sin(angle) * radius * 0.83 - effect * 55;
        if (index % 2) heart(ctx, x, y, 11 + index % 4 * 3, index % 3 ? "#d482a5" : "#f2bed3");
        else star(ctx, x, y, 10 + index % 4 * 3);
      }
      ctx.restore();
    }
  };

  const animate = (now: number) => {
    if (disposed) return;
    try { draw(now); }
    catch { fail(); return; }
    raf = requestAnimationFrame(animate);
  };

  try {
    draw(performance.now());
    stream = canvas.captureStream(24);
    const candidates = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const mimeType of candidates) {
      if (typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(mimeType)) continue;
      try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 }); break; }
      catch { /* Try the next browser-supported container. */ }
    }
    recorder ??= new MediaRecorder(stream, { videoBitsPerSecond: 2_500_000 });
    recorder.ondataavailable = (event) => { if (!discard && event.data.size) chunks.push(event.data); };
    recorder.onerror = fail;
    recorder.onstop = complete;
    recorder.start(250);
    raf = requestAnimationFrame(animate);
  } catch (error) {
    cancel();
    throw error;
  }

  return {
    updateCountdown: (count, nextPose) => { countdown = count; pose = nextPose; },
    markShot: (src) => {
      if (disposed) return;
      completed += 1;
      lastShutter = performance.now();
      const image = new Image();
      photos.push(image);
      image.src = src;
      // Paint immediately as well as on RAF so no shutter is lost between frames.
      try { draw(lastShutter); } catch { fail(); }
    },
    finish: () => {
      if (!discard && !stopped) {
        try {
          if (recorder?.state !== "inactive") {
            recorder?.stop();
            cleanup();
            // A broken browser encoder must not keep the photo buttons busy forever.
            stopTimer = window.setTimeout(fail, 5000);
          } else complete();
        }
        catch { fail(); }
      }
      return finished;
    },
    cancel,
  };
}
