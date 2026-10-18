export const PHOTOBOOTH_SHOTS = 3;

const WIDTH = 1080;
const HEIGHT = 2544;
const PHOTO_X = 106;
const PHOTO_WIDTH = 868;
const PHOTO_HEIGHT = PHOTO_WIDTH * 3 / 4;
const PHOTO_TOP = 298;
const PHOTO_STEP = PHOTO_HEIGHT + 48;
const INK = "#99546f";
const ROSE = "#c67d9a";
const CREAM = "#fffaf5";
const TITLE_FONT = '500 88px "Dancing Script", cursive';
const BODY_FONT = '400 24px "Be Vietnam Pro", sans-serif';

/** The same centre crop is used by the 4:3 camera preview and captured photo. */
export function getPhotoboothCrop(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Máy ảnh chưa có hình. Cậu thử bật lại máy ảnh nhé.");
  }
  const cropWidth = Math.min(width, height * 4 / 3);
  const cropHeight = cropWidth * 3 / 4;
  return {
    x: (width - cropWidth) / 2,
    y: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export function capturePhotoboothShot(video: HTMLVideoElement, mirrored = true): string {
  const stream = video.srcObject as MediaStream | null;
  const tracks = stream?.getVideoTracks?.();
  if (video.readyState < 2 || video.ended || (tracks && !tracks.some((track) => track.readyState === "live"))) {
    throw new Error("Máy ảnh chưa sẵn sàng. Cậu chờ hình hiện lên rồi chụp nhé.");
  }
  const crop = getPhotoboothCrop(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  // Keep an entire three-shot strip well below mobile canvas memory limits.
  canvas.width = Math.max(4, Math.floor(Math.min(1200, crop.width) / 4) * 4);
  canvas.height = canvas.width * 3 / 4;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiết bị chưa hỗ trợ tạo ảnh. Cậu thử trình duyệt khác nhé.");
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled = false, color = ROSE) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.bezierCurveTo(-26, -5, -11, -24, 0, -11);
  ctx.bezierCurveTo(11, -24, 26, -5, 0, 11);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  if (filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

function bow(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = ROSE;
  ctx.fillStyle = "#f5dce5";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.bezierCurveTo(-66, -60, -70, 33, -3, 0);
  ctx.moveTo(3, 0);
  ctx.bezierCurveTo(66, -60, 70, 33, 3, 0);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, 5);
  ctx.quadraticCurveTo(-9, 28, -28, 50);
  ctx.lineTo(-10, 47);
  ctx.lineTo(-2, 57);
  ctx.quadraticCurveTo(9, 31, 3, 4);
  ctx.moveTo(6, 5);
  ctx.quadraticCurveTo(26, 24, 30, 46);
  ctx.lineTo(43, 41);
  ctx.lineTo(53, 48);
  ctx.quadraticCurveTo(37, 12, 7, 0);
  ctx.fill();
  ctx.stroke();
  roundedRect(ctx, -7, -6, 14, 15, 5);
  ctx.fillStyle = "#e5b8cb";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = "#d3a0b3";
  ctx.fillStyle = "#fffdf7";
  ctx.lineWidth = 1;
  for (let petal = 0; petal < 6; petal++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, -11, 5.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#efd7a6";
  ctx.fill();
  ctx.restore();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#d9ae79";
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(2, -2, size * 0.65, 0);
  ctx.quadraticCurveTo(2, 2, 0, size);
  ctx.quadraticCurveTo(-2, 2, -size * 0.65, 0);
  ctx.quadraticCurveTo(-2, -2, 0, -size);
  ctx.fill();
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, index: number) {
  const gradient = ctx.createLinearGradient(x, y, x + PHOTO_WIDTH, y + PHOTO_HEIGHT);
  gradient.addColorStop(0, "#f8e8ed");
  gradient.addColorStop(0.5, "#fff7f4");
  gradient.addColorStop(1, "#f5e4e7");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
  const centerX = x + PHOTO_WIDTH / 2;
  const centerY = y + PHOTO_HEIGHT / 2;
  ctx.strokeStyle = "#c795aa";
  ctx.lineWidth = 3;
  roundedRect(ctx, centerX - 42, centerY - 39, 84, 61, 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX - 23, centerY - 39);
  ctx.lineTo(centerX - 17, centerY - 50);
  ctx.lineTo(centerX + 17, centerY - 50);
  ctx.lineTo(centerX + 23, centerY - 39);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY - 9, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ac7b91";
  ctx.font = '400 27px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`Khoảnh khắc ${index + 1}`, centerX, centerY + 84);
  heart(ctx, centerX - 157, centerY - 10, 18);
  heart(ctx, centerX + 157, centerY - 10, 18);
}

async function loadPhoto(src: string): Promise<HTMLImageElement> {
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(src)) {
    throw new Error("Ảnh chụp chưa hợp lệ. Cậu chụp lại tấm này nhé.");
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      if (image.naturalWidth && image.naturalHeight) resolve();
      else reject(new Error("Ảnh chụp đang trống. Cậu chụp lại nhé."));
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Không mở được ảnh chụp. Cậu chụp lại nhé."));
    };
    image.src = src;
  });
  return image;
}

async function loadFonts() {
  if (!document.fonts) return;
  // A failed optional font falls back to the canvas font stack, not a blank frame.
  await Promise.allSettled([
    document.fonts.load(TITLE_FONT, "Digimar 66D"),
    document.fonts.load(BODY_FONT, "giữ lại những khoảnh khắc đáng yêu Một chút dễ thương, thật nhiều kỷ niệm 01 02 03"),
  ]);
  await document.fonts.ready;
}

/** One renderer supplies the empty/partial preview and the final saved PNG. */
export async function createPhotoboothImage(shots: readonly string[]): Promise<File> {
  if (shots.length > PHOTOBOOTH_SHOTS) throw new Error("Mỗi khung photobooth có ba ảnh thôi nhé.");
  const [photos] = await Promise.all([Promise.all(shots.map(loadPhoto)), loadFonts()]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiết bị chưa hỗ trợ tạo ảnh. Cậu thử trình duyệt khác nhé.");
  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#fff7f1");
  background.addColorStop(0.5, CREAM);
  background.addColorStop(1, "#fcecf1");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#e8bfce";
  for (let x = 28; x < WIDTH; x += 36) {
    for (let y = 26; y < HEIGHT; y += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "#ddb2c2";
  ctx.lineWidth = 2;
  roundedRect(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 32);
  ctx.stroke();
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = "#e5bccb";
  roundedRect(ctx, 32, 32, WIDTH - 64, HEIGHT - 64, 24);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = TITLE_FONT;
  ctx.fillText("Digimar 66D", WIDTH / 2, 135);
  ctx.font = BODY_FONT;
  ctx.fillStyle = "#af7d91";
  ctx.fillText("giữ lại những khoảnh khắc đáng yêu", WIDTH / 2, 194);
  heart(ctx, WIDTH / 2, 244, 20, true);
  ctx.strokeStyle = "#dfb4c4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(350, 242); ctx.lineTo(489, 242);
  ctx.moveTo(591, 242); ctx.lineTo(730, 242);
  ctx.stroke();
  bow(ctx, 150, 172, 0.83, -0.19);
  bow(ctx, 925, 172, 0.83, 0.19);
  sparkle(ctx, 104, 86, 13);
  sparkle(ctx, 974, 96, 17);

  for (let index = 0; index < PHOTOBOOTH_SHOTS; index++) {
    const top = PHOTO_TOP + index * PHOTO_STEP;
    ctx.save();
    ctx.shadowColor = "#875c7020";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#fffdfa";
    roundedRect(ctx, PHOTO_X - 14, top - 14, PHOTO_WIDTH + 28, PHOTO_HEIGHT + 28, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#ead8dc";
    ctx.lineWidth = 1;
    roundedRect(ctx, PHOTO_X - 14, top - 14, PHOTO_WIDTH + 28, PHOTO_HEIGHT + 28, 8);
    ctx.stroke();
    ctx.save();
    roundedRect(ctx, PHOTO_X, top, PHOTO_WIDTH, PHOTO_HEIGHT, 3);
    ctx.clip();
    const photo = photos[index];
    if (photo) {
      const crop = getPhotoboothCrop(photo.naturalWidth, photo.naturalHeight);
      ctx.drawImage(photo, crop.x, crop.y, crop.width, crop.height, PHOTO_X, top, PHOTO_WIDTH, PHOTO_HEIGHT);
    } else drawPlaceholder(ctx, PHOTO_X, top, index);
    ctx.restore();
    ctx.font = '400 17px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = "#b78198";
    ctx.textAlign = "center";
    ctx.fillText(`0${index + 1}`, WIDTH / 2, top + PHOTO_HEIGHT + 29);
    heart(ctx, 55, top + 146, 19, index % 2 === 0);
    flower(ctx, WIDTH - 55, top + 305, 18);
    sparkle(ctx, 52, top + 458, 14);
    heart(ctx, WIDTH - 53, top + 558, 14);
    if (index === 1) {
      flower(ctx, 55, top + 296, 18);
      sparkle(ctx, WIDTH - 52, top + 108, 14);
    }
  }

  bow(ctx, WIDTH / 2, 2408, 0.48, 0);
  ctx.font = BODY_FONT;
  ctx.fillStyle = INK;
  ctx.fillText("Một chút dễ thương, thật nhiều kỷ niệm", WIDTH / 2, 2490);
  flower(ctx, 122, 2453, 21);
  flower(ctx, WIDTH - 122, 2453, 21);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Chưa tạo được ảnh PNG. Cậu thử lại nhé.")), "image/png");
  });
  return new File([blob], "Digimar66D-photobooth.png", { type: "image/png" });
}
