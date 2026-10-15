import { toBlob } from "html-to-image";

/** Prepare the PNG before a save click so native dialogs keep user activation. */
export async function createCardImage(source: HTMLDivElement, recipientId: string) {
  let exportContainer: HTMLDivElement | null = null;
  try {
    await document.fonts.ready;
    const clone = source.cloneNode(true) as HTMLDivElement;
    clone.style.width = `${Math.max(1000, source.getBoundingClientRect().width)}px`;
    clone.style.maxWidth = "none";
    clone.dataset.cardExport = "true";
    clone.querySelectorAll<HTMLElement>(".card-letter p").forEach((paragraph) => {
      paragraph.style.opacity = "1";
      paragraph.style.transform = "none";
      paragraph.style.animation = "none";
      paragraph.style.transition = "none";
    });
    exportContainer = document.createElement("div");
    exportContainer.setAttribute("aria-hidden", "true");
    exportContainer.style.cssText =
      "position:fixed;left:-10000px;top:0;pointer-events:none;";
    exportContainer.appendChild(clone);
    document.body.appendChild(exportContainer);
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) => {
        img.loading = "eager";
        return img.decode();
      }),
    );
    const blob = await toBlob(clone, {
      pixelRatio: 3,
      backgroundColor: "#fff9f5",
    });
    if (!blob) throw new Error("Could not create the card image");
    return new File(
      [blob],
      `DM66D-20-10-${recipientId.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`,
      { type: "image/png" },
    );
  } finally {
    exportContainer?.remove();
  }
}
