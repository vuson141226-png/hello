export type SaveImageResult =
  | "saved"
  | "shared"
  | "downloaded"
  | "preview"
  | "cancelled";

interface ImageWritable {
  write(file: File): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface ImageFileHandle {
  createWritable(): Promise<ImageWritable>;
}

interface SavePickerOptions {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (
    options: SavePickerOptions,
  ) => Promise<ImageFileHandle>;
};

type MobileNavigator = Navigator & {
  userAgentData?: { mobile?: boolean };
};

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const device = navigator as MobileNavigator;
  return (
    device.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1)
  );
}

export function downloadImage(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;

  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Safari may start reading the image after the click handler returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function wasCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function saveImage(file: File): Promise<SaveImageResult> {
  if (isMobileDevice()) {
    try {
      const shareData = { files: [file] };
      if (
        typeof navigator.canShare !== "function" ||
        typeof navigator.share !== "function" ||
        !navigator.canShare(shareData)
      ) {
        return "preview";
      }

      // Invoke the native sheet before any await consumes the tap activation.
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      return wasCancelled(error) ? "cancelled" : "preview";
    }
  }

  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) {
    try {
      downloadImage(file);
      return "downloaded";
    } catch {
      return "preview";
    }
  }

  let writable: ImageWritable | undefined;
  try {
    // Open the picker synchronously while this call still has click activation.
    const handle = await picker.call(window, {
      suggestedName: file.name,
      types: [{ description: "Ảnh PNG", accept: { "image/png": [".png"] } }],
    });
    writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return "saved";
  } catch (error) {
    try {
      // Discard any partial write; retain the original failure if abort fails.
      await writable?.abort?.();
    } catch {
      // The caller can still offer the image preview for manual saving.
    }
    return wasCancelled(error) ? "cancelled" : "preview";
  }
}
