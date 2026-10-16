export interface SavedLetter {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
  status: "saved";
}

export interface LetterSubmission {
  senderName: string;
  message: string;
  submissionId: string;
  website: string;
}

export interface AdminSession {
  authenticated: boolean;
  email?: string;
}

export interface LettersList {
  letters: SavedLetter[];
  total: number;
}

export class LettersApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "LettersApiError";
    this.status = status;
  }
}

const errorMessage = (status: number, body: unknown): string => {
  if (status === 503) {
    return "Hệ thống lưu lời nhắn chưa kết nối được. Cậu hãy thử lại sau nhé; nội dung vẫn được giữ ở đây.";
  }
  if (status === 429) {
    return "Cậu đã gửi nhiều lần liên tiếp. Hãy đợi một chút rồi gửi lại nhé.";
  }
  if (status === 401) {
    return "Phiên quản trị đã hết hạn hoặc thông tin đăng nhập chưa đúng. Vui lòng đăng nhập lại.";
  }
  if (body && typeof body === "object") {
    const value = body as { error?: unknown; message?: unknown };
    const message = value.message ?? value.error;
    if (typeof message === "string" && message.length < 350) return message;
  }
  return "Chưa thể kết nối với hệ thống. Cậu thử lại nhé; lời nhắn chưa bị xóa.";
};

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json", ...init.headers },
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new LettersApiError(errorMessage(response.status, body), response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof LettersApiError) throw error;
    throw new LettersApiError(
      error instanceof DOMException && error.name === "AbortError"
        ? "Hệ thống chưa phản hồi kịp. Cậu có thể gửi lại; yêu cầu cũ sẽ không tạo thêm bản trùng."
        : "Không kết nối được với máy chủ. Kiểm tra mạng rồi thử lại nhé; nội dung của cậu vẫn được giữ nguyên.",
    );
  } finally {
    window.clearTimeout(timer);
  }
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  try {
    return (await response.json()) as T;
  } catch {
    throw new LettersApiError("Máy chủ chưa xác nhận dữ liệu. Vui lòng thử lại sau.");
  }
}

const jsonBody = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export async function submitLetter(data: LetterSubmission): Promise<SavedLetter> {
  const result = await jsonRequest<{ letter?: SavedLetter } & Partial<SavedLetter>>(
    "/api/letters",
    jsonBody(data),
  );
  const letter = result.letter ?? result;
  if (letter.status !== "saved" || typeof letter.id !== "string" || !letter.id) {
    throw new LettersApiError("Máy chủ chưa xác nhận đã lưu lời nhắn. Cậu thử gửi lại nhé.");
  }
  return letter as SavedLetter;
}

export const getAdminSession = (): Promise<AdminSession> =>
  jsonRequest<AdminSession>("/api/admin/session");

export const loginAdmin = (email: string, password: string): Promise<AdminSession> =>
  jsonRequest<AdminSession>("/api/admin/login", jsonBody({ email, password }));

export const logoutAdmin = (): Promise<unknown> =>
  jsonRequest<unknown>("/api/admin/logout", jsonBody({}));

export const getLetters = (order: "newest" | "oldest"): Promise<LettersList> =>
  jsonRequest<LettersList>(`/api/admin/letters?order=${order}`);

export async function exportLetters(format: "csv" | "json"): Promise<void> {
  const response = await request(`/api/admin/export?format=${format}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DM66_Loi_Nhan_20_10.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const letterCharacterCount = (value: string): number => Array.from(value).length;
