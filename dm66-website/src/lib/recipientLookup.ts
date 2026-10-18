import { normalizeName } from "./recipients";

export interface RecipientWish {
  id: string;
  title: string;
  senderName: string;
  message: string;
  image?: string;
  imageFile?: string;
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
  const response = await fetch("/data/recipient-wishes.json", { signal });
  if (!response.ok) throw new Error("Could not load wishes");
  const recipients: unknown = await response.json();
  if (!Array.isArray(recipients) || recipients.some((recipient) =>
    !recipient || typeof recipient.fullName !== "string" || typeof recipient.studentCode !== "string" || !Array.isArray(recipient.wishes),
  )) throw new Error("Invalid wish data");
  return recipients as WishRecipient[];
}
