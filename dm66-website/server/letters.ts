import type { ApiRequest } from './http.js';
import { HttpError } from './http.js';
import { ipDigest, ProviderError, provider, rpc } from './supabase.js';

export interface Letter {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
  status: 'saved';
}

export function validateSubmission(body: Record<string, unknown>) {
  if (body.website !== undefined && (typeof body.website !== 'string' || body.website.trim())) throw new HttpError(400, 'Yêu cầu không hợp lệ.');
  if (body.senderName !== undefined && typeof body.senderName !== 'string') throw new HttpError(400, 'Tên người gửi không hợp lệ.');
  const senderName = (body.senderName as string | undefined)?.trim() || 'Một cô gái DM66D';
  if (Array.from(senderName).length > 100 || /[\u0000-\u001f\u007f]/.test(senderName)) throw new HttpError(400, 'Tên người gửi tối đa 100 ký tự.');
  if (typeof body.message !== 'string') throw new HttpError(400, 'Cậu hãy viết lời nhắn nhé.');
  const message = body.message.trim();
  const length = Array.from(message).length;
  if (length < 5 || length > 2000 || /\u0000/.test(message)) throw new HttpError(400, 'Lời nhắn cần từ 5 đến 2.000 ký tự.');
  if (typeof body.submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.submissionId)) throw new HttpError(400, 'Mã gửi thư không hợp lệ. Hãy tải lại trang và thử lại.');
  return { senderName, message, submissionId: body.submissionId.toLowerCase() };
}

type StoredLetter = { id: string; sender_name: string; message: string; created_at: string; status: 'saved'; replayed?: boolean };

export function publicLetter(value: StoredLetter): Letter {
  return { id: value.id, senderName: value.sender_name, message: value.message, createdAt: value.created_at, status: value.status };
}

export async function submitLetter(request: ApiRequest, body: Record<string, unknown>) {
  const input = validateSubmission(body);
  try {
    const result = await rpc('dm66_submit_letter', { p_submission_id: input.submissionId, p_sender_name: input.senderName, p_message: input.message, p_ip_hash: ipDigest(request) });
    const row = Array.isArray(result) ? result[0] as StoredLetter | undefined : undefined;
    if (!row || row.status !== 'saved' || !row.id || !row.created_at) throw new Error('Missing committed letter');
    return { letter: publicLetter(row), replayed: row.replayed === true };
  } catch (error) {
    if (error instanceof ProviderError) {
      if (error.detail.message === 'DM66_RATE_LIMIT') throw new HttpError(429, 'Có nhiều thư đang được gửi. Cậu chờ một phút rồi thử lại nhé.');
      if (error.detail.message === 'DM66_SUBMISSION_CONFLICT') throw new HttpError(409, 'Mã gửi thư đã được sử dụng cho nội dung khác. Hãy viết một thư mới.');
    }
    throw error;
  }
}

export function sortOrder(value: string | null) {
  if (value && value !== 'newest' && value !== 'oldest') throw new HttpError(400, 'Thứ tự không hợp lệ.');
  return value === 'oldest' ? 'asc' : 'desc';
}

export async function allLetters(order: 'asc' | 'desc'): Promise<Letter[]> {
  const letters: Letter[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, headers } = await provider(`/rest/v1/dm66_letters?select=id,sender_name,message,created_at,status&order=created_at.${order},id.${order}`, {
      headers: { Range: `${from}-${from + 999}`, Prefer: 'count=exact' },
    });
    if (!Array.isArray(data)) throw new Error('Invalid stored letters');
    letters.push(...(data as StoredLetter[]).map(publicLetter));
    const total = Number(headers.get('content-range')?.split('/')[1]);
    if (data.length < 1000 || (Number.isFinite(total) && letters.length >= total)) break;
  }
  return letters;
}

function csvCell(value: string) {
  // Spreadsheet applications execute cells beginning with formula characters,
  // even when the CSV field is quoted. Prefix such user input with an apostrophe.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportCsv(letters: Letter[]) {
  const rows = [['id', 'senderName', 'message', 'createdAt', 'status'], ...letters.map(letter => [letter.id, letter.senderName, letter.message, letter.createdAt, letter.status])];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
