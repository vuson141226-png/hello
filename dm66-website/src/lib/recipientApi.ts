import type { Girl } from "../data/girls";

export interface RecipientWish {
  id: string;
  title: string;
  senderName: string;
  message: string;
}
export interface RecipientSession {
  authenticated: true;
  recipient: Omit<Girl, "wish" | "nicknames" | "senderName">;
  wishes: RecipientWish[];
}
export class RecipientApiError extends Error {
  constructor(public readonly status: number) {
    super(status === 401
      ? "Tên hoặc mã sinh viên chưa đúng. Cậu kiểm tra lại nhé!"
      : status === 429
        ? "Cậu đã thử nhiều lần. Đợi một chút rồi thử lại nhé!"
        : "Chưa thể kết nối để mở lời nhắn. Cậu thử lại sau nhé!");
  }
}
async function request(path: string, options: RequestInit, signal?: AbortSignal) {
  const response = await fetch(`/api/recipient/${path}`, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new RecipientApiError(response.status);
  return response;
}
let pendingLogout: Promise<void> | null = null;
let logoutUnconfirmed = false;

export async function recipientSession(signal?: AbortSignal): Promise<RecipientSession> {
  if (pendingLogout) await pendingLogout;
  if (logoutUnconfirmed) throw new RecipientApiError(401);
  const response = await request("session", { method: "GET" }, signal);
  return response.json() as Promise<RecipientSession>;
}
export async function loginRecipient(fullName: string, studentCode: string, signal?: AbortSignal) {
  if (pendingLogout) await pendingLogout;
  if (logoutUnconfirmed) await logoutRecipient();
  await request("login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, studentCode }),
  }, signal);
}
export async function logoutRecipient() {
  if (pendingLogout) return pendingLogout;
  logoutUnconfirmed = true;
  // Let revocation finish across navigation; no new account can start before it succeeds.
  pendingLogout = request("logout", { method: "POST", keepalive: true }).then(() => {
    logoutUnconfirmed = false;
  }).finally(() => { pendingLogout = null; });
  return pendingLogout;
}
