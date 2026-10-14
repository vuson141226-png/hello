import type { Girl } from "../data/girls";

/** Compare Vietnamese names without accents, case, or repeated whitespace. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Return every exact normalized name match. Multiple people can share a name
 * or nickname, so the caller must let the visitor choose when necessary.
 */
export function findRecipients(query: string, recipients: Girl[]): Girl[] {
  const normalizedQuery = normalizeName(query);

  if (!normalizedQuery) return [];

  return recipients.filter((recipient) =>
    [recipient.fullName, recipient.displayName, ...recipient.nicknames].some(
      (name) => normalizeName(name) === normalizedQuery,
    ),
  );
}
