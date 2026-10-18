import { normalizeName } from "./recipients";

export interface RecipientWish {
  id: string;
  title: string;
  senderName: string;
  message: string;
  image?: string;
  imageFile?: string;
}

export interface AnniversaryPhoto {
  src: string;
  altText: string;
  width?: number;
  height?: number;
}

export interface AnniversaryExperience {
  kind: "one-month";
  images: AnniversaryPhoto[];
}

export interface WishRecipient {
  id: string;
  fullName: string;
  displayName: string;
  studentCode: string;
  image: string;
  introduction: string;
  personality: string;
  memory?: string;
  wishes: RecipientWish[];
  anniversary?: AnniversaryExperience;
}

/** Look up both fields from the spreadsheet; student codes remain strings. */
export function findWishRecipient(fullName: string, studentCode: string, recipients: WishRecipient[]): WishRecipient | undefined {
  const name = normalizeName(fullName);
  const code = studentCode.trim().toUpperCase();
  if (!name || !code) return undefined;
  return recipients.find((recipient) =>
    normalizeName(recipient.fullName) === name && recipient.studentCode.trim().toUpperCase() === code,
  );
}

export async function loadRecipients(signal?: AbortSignal): Promise<WishRecipient[]> {
  const directories = await Promise.all([
    "/data/recipient-wishes.json",
    "/data/special-recipients.json",
  ].map(async (url) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Could not load wishes");
    const recipients: unknown = await response.json();
    if (!Array.isArray(recipients) || recipients.some((recipient) =>
      !recipient || typeof recipient.fullName !== "string" || typeof recipient.studentCode !== "string" || !Array.isArray(recipient.wishes) ||
      (recipient.anniversary !== undefined && (
        recipient.anniversary?.kind !== "one-month" || !Array.isArray(recipient.anniversary.images) ||
        recipient.anniversary.images.some((photo: AnniversaryPhoto) => !photo || typeof photo.src !== "string" || typeof photo.altText !== "string")
      )),
    )) throw new Error("Invalid wish data");
    return recipients as WishRecipient[];
  }));
  return directories.flat();
}
