const BODY_FONT = '400 14px "Be Vietnam Pro", sans-serif';
const DEAR_FONT = '500 36px "Dancing Script", cursive';
const TITLE_FONT = '500 47px "Cormorant Garamond", Georgia, serif';
const DATE_FONT = 'italic 500 47px "Cormorant Garamond", Georgia, serif';
const SIGNATURE_FONT = '500 26px "Dancing Script", cursive';
const SMALL_FONT = '400 8px "Be Vietnam Pro", sans-serif';
const CREAM = "#fff9f5";

type TextBlock = {
  lines: string[];
  font: string;
  color: string;
  lineHeight: number;
  ascent: number;
  descent: number;
  height: number;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("vi", { granularity: "grapheme" }) : null;
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      const letters = segmenter
        ? Array.from(segmenter.segment(word), (part) => part.segment)
        : Array.from(word);
      for (const letter of letters) {
        if (line && ctx.measureText(line + letter).width > width) {
          lines.push(line);
          line = "";
        }
        line += letter;
      }
    }
    lines.push(line);
  }
  return lines;
}

function makeBlock(
  ctx: CanvasRenderingContext2D, text: string, width: number,
  font: string, color: string, requestedLineHeight: number,
): TextBlock {
  ctx.font = font;
  const lines = wrapText(ctx, text, width);
  const metrics = lines.map((line) => ctx.measureText(line || "Ágỵ"));
  const ascent = Math.max(...metrics.map((m) => m.actualBoundingBoxAscent));
  const descent = Math.max(...metrics.map((m) => m.actualBoundingBoxDescent));
  const lineHeight = Math.max(requestedLineHeight, Math.ceil(ascent + descent) + 8);
  return { lines, font, color, ascent, descent, lineHeight, height: lines.length * lineHeight };
}

function drawBlock(ctx: CanvasRenderingContext2D, block: TextBlock, x: number, y: number) {
  ctx.font = block.font;
  ctx.fillStyle = block.color;
  ctx.textBaseline = "alphabetic";
  const baseline = (block.lineHeight - block.ascent - block.descent) / 2 + block.ascent;
  block.lines.forEach((line, index) => ctx.fillText(line, x, y + baseline + index * block.lineHeight));
}

function trackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alignRight = false) {
  ctx.font = SMALL_FONT;
  ctx.fillStyle = "#b48397";
  ctx.textBaseline = "middle";
  const letters = Array.from(text);
  const spacing = 1.5;
  const width = letters.reduce((sum, letter) => sum + ctx.measureText(letter).width, 0)
    + Math.max(0, letters.length - 1) * spacing;
  let cursor = alignRight ? x - width : x;
  letters.forEach((letter) => {
    ctx.fillText(letter, cursor, y);
    cursor += ctx.measureText(letter).width + spacing;
  });
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 12, size / 12);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-15, -5, -5, -14, 0, -8);
  ctx.bezierCurveTo(5, -14, 15, -5, 0, 4);
  ctx.strokeStyle = ctx.fillStyle = "#c8819f";
  ctx.lineWidth = 0.8;
  if (filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

function bow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.25);
  ctx.strokeStyle = "#bc7c9c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-30, -37, -41, 8, 0, 0);
  ctx.bezierCurveTo(30, -37, 41, 8, 0, 0);
  ctx.moveTo(-2, 1);
  ctx.lineTo(-13, 20);
  ctx.lineTo(-2, 14);
  ctx.lineTo(0, 2);
  ctx.lineTo(5, 19);
  ctx.lineTo(14, 24);
  ctx.lineTo(2, 1);
  ctx.stroke();
  ctx.restore();
}

async function loadPhoto(src: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load the card photo");
  const url = URL.createObjectURL(await response.blob());
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode the card photo"));
      image.src = url;
    });
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty card photo");
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Canvas avoids WebKit's SVG foreignObject image/font rendering failures. */
export async function createCardImage(source: HTMLDivElement, recipientId: string) {
  const photo = source.querySelector<HTMLImageElement>(".card-photo img");
  if (!photo) throw new Error("Missing card photo");
  const content = (selector: string) => source.querySelector(selector)?.textContent?.trim() || "";
  const dear = content(".card-dear");
  const titleElement = source.querySelector("h2");
  const title = Array.from(titleElement?.childNodes || [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent).join("").trim();
  const date = content("h2 em");
  const paragraphs = Array.from(source.querySelectorAll(".card-letter p"))
    .map((paragraph) => paragraph.textContent?.trim() || "");
  const note = content(".card-placeholder-note");
  const signature = content(".card-signature > span");
  const footer = content(".card-signature > small");
  const header = source.querySelector(".card-topline");
  const labels = Array.from(header?.querySelectorAll("span") || [])
    .map((label) => label.textContent?.trim() || "");

  // Load Vietnamese glyph subsets before measuring, not just before painting.
  await Promise.all([
    document.fonts.load(DEAR_FONT, dear),
    document.fonts.load(TITLE_FONT, title),
    document.fonts.load(DATE_FONT, date),
    document.fonts.load(BODY_FONT, paragraphs.join(" ") + note),
    document.fonts.load(SIGNATURE_FONT, signature),
    document.fonts.load(SMALL_FONT, labels.join(" ") + footer),
  ]);
  await document.fonts.ready;
  const loaded = await loadPhoto(photo.currentSrc || photo.src);
  try {
    const width = Math.max(1000, Math.round(source.getBoundingClientRect().width));
    const padding = 44;
    const gap = 48;
    const leftWidth = (width - padding * 2 - gap) * 0.475;
    const textX = padding + leftWidth + gap;
    const textWidth = width - padding - textX;
    const frameWidth = Math.min(400, leftWidth);
    const inset = 11;
    const photoWidth = frameWidth - inset * 2;
    const photoHeight = photoWidth * 1.25;
    const frameHeight = photoHeight + inset * 2;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");

    const dearBlock = makeBlock(ctx, dear, textWidth, DEAR_FONT, "#b66e8a", 54);
    const titleBlock = makeBlock(ctx, title, textWidth, TITLE_FONT, "#573847", 58);
    const dateBlock = makeBlock(ctx, date, textWidth, DATE_FONT, "#a74870", 58);
    const wishBlocks = paragraphs.map((text) => makeBlock(ctx, text, textWidth, BODY_FONT, "#856371", 30));
    const noteBlock = note ? makeBlock(ctx, note, textWidth, '400 10px "Be Vietnam Pro", sans-serif', "#856371", 20) : null;
    const signatureBlock = makeBlock(ctx, signature, textWidth, SIGNATURE_FONT, "#a56883", 40);
    const footerBlock = makeBlock(ctx, footer, textWidth, SMALL_FONT, "#b993a4", 16);
    const wishHeight = wishBlocks.reduce((sum, block) => sum + block.height + 11, 0);
    const messageHeight = dearBlock.height + 8 + titleBlock.height + dateBlock.height + 20
      + wishHeight + (noteBlock ? noteBlock.height + 14 : 0) + 28 + 22
      + signatureBlock.height + 8 + footerBlock.height;
    const bodyHeight = Math.max(frameHeight, messageHeight);
    const bodyTop = 100;
    const height = Math.ceil(bodyTop + bodyHeight + 44);
    // Keep long letters below iOS canvas limits rather than exporting blank PNGs.
    const ratio = Math.min(3, Math.sqrt(12_000_000 / (width * height)), 8192 / width, 8192 / height);
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    ctx.scale(ratio, ratio);
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#e3becd";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#e7c7d4";
    ctx.strokeRect(9.5, 9.5, width - 19, height - 19);
    ctx.setLineDash([]);
    trackedText(ctx, labels[0] || "DIGITAL MARKETING 66D", padding, 44);
    trackedText(ctx, labels[1] || "20.10.2026", width - padding, 44, true);
    heart(ctx, width / 2, 46, 7, false);

    const frameX = padding + (leftWidth - frameWidth) / 2;
    const frameY = bodyTop + (bodyHeight - frameHeight) / 2;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(frameX, frameY, frameWidth, frameHeight);
    ctx.strokeStyle = "#ecded8";
    ctx.strokeRect(frameX, frameY, frameWidth, frameHeight);
    ctx.fillStyle = CREAM;
    ctx.fillRect(frameX + inset, frameY + inset, photoWidth, photoHeight);
    const fit = Math.min(photoWidth / loaded.image.naturalWidth, photoHeight / loaded.image.naturalHeight);
    const imageWidth = loaded.image.naturalWidth * fit;
    const imageHeight = loaded.image.naturalHeight * fit;
    ctx.drawImage(loaded.image,
      frameX + inset + (photoWidth - imageWidth) / 2,
      frameY + inset + (photoHeight - imageHeight) / 2, imageWidth, imageHeight);
    bow(ctx, frameX + frameWidth - 14, frameY + 2);

    let y = bodyTop + (bodyHeight - messageHeight) / 2;
    drawBlock(ctx, dearBlock, textX, y); y += dearBlock.height + 8;
    drawBlock(ctx, titleBlock, textX, y); y += titleBlock.height;
    drawBlock(ctx, dateBlock, textX, y); y += dateBlock.height + 20;
    wishBlocks.forEach((block) => { drawBlock(ctx, block, textX, y); y += block.height + 11; });
    if (noteBlock) { y += 14; drawBlock(ctx, noteBlock, textX, y); y += noteBlock.height; }
    y += 28;
    ctx.strokeStyle = "#e3bfce";
    ctx.beginPath(); ctx.moveTo(textX, y); ctx.lineTo(textX + 66, y); ctx.stroke();
    heart(ctx, textX + 6, y + 18, 6, true);
    y += 22;
    drawBlock(ctx, signatureBlock, textX, y); y += signatureBlock.height + 8;
    drawBlock(ctx, footerBlock, textX, y);

    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Could not encode the card PNG")), "image/png",
    ));
    return new File([blob], `DM66D-20-10-${recipientId.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`, { type: "image/png" });
  } finally {
    loaded.release();
  }
}
