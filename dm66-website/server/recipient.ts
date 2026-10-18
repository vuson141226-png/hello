import { createHash, randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { ApiRequest } from './http.js';
import { HttpError } from './http.js';
import { ipDigest, rpc } from './supabase.js';

const sessionCookie = 'dm66_recipient_session';
const sessionSeconds = 8 * 60 * 60;
const incorrectLogin = 'Tên hoặc mã sinh viên không đúng. Cậu kiểm tra lại nhé.';

// Keep this identical to src/lib/recipients.normalizeName. No private data is
// shared with or imported from the browser bundle.
export function normalizeRecipientName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Codes are case-insensitive; whitespace is allowed only around the code. */
export function normalizeStudentCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9._-]{3,64}$/.test(code) ? code : null;
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function currentToken(request: ApiRequest) {
  const values = (request.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${sessionCookie}=`));
  if (values.length !== 1) return undefined;
  const token = values[0].slice(sessionCookie.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}

function writeCookie(request: ApiRequest, response: ServerResponse, token?: string) {
  const host = request.headers.host || '';
  const secure = request.headers['x-forwarded-proto'] === 'https' || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  response.setHeader('Set-Cookie', `${sessionCookie}=${token || ''}; Max-Age=${token ? sessionSeconds : 0}; Path=/api/recipient; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`);
}

export async function recipientLogin(request: ApiRequest, response: ServerResponse, body: Record<string, unknown>) {
  const fullName = typeof body.fullName === 'string' && body.fullName.length <= 200 && !/[\u0000-\u001f\u007f]/.test(body.fullName) ? normalizeRecipientName(body.fullName) : '';
  const code = typeof body.studentCode === 'string' ? normalizeStudentCode(body.studentCode) : null;
  const token = randomBytes(32).toString('base64url');
  const previous = currentToken(request);
  // Failed attempts are committed by the RPC too; throwing inside that database
  // transaction would silently roll the rate-limit counters back.
  const result = await rpc('dm66_recipient_login', {
    p_normalized_name: fullName, p_student_code: code || '', p_ip_hash: ipDigest(request),
    p_session_hash: tokenHash(token), p_previous_session_hash: previous ? tokenHash(previous) : null,
  });
  if (!result || typeof result !== 'object') throw new Error('Invalid recipient login result');
  const value = result as Record<string, unknown>;
  if (value.limited === true) throw new HttpError(429, 'Có nhiều lần đăng nhập. Cậu thử lại sau 15 phút nhé.', 'RECIPIENT_RATE_LIMIT', 900);
  if (value.authenticated !== true) throw new HttpError(401, incorrectLogin, 'RECIPIENT_LOGIN_FAILED');
  writeCookie(request, response, token);
  return { authenticated: true };
}

function requiredString(value: unknown) {
  if (typeof value !== 'string') throw new Error('Invalid private recipient projection');
  return value;
}

export async function recipientSession(request: ApiRequest, response: ServerResponse) {
  const token = currentToken(request);
  if (token) {
    const result = await rpc('dm66_recipient_session', { p_session_hash: tokenHash(token) });
    if (result && typeof result === 'object') {
      const value = result as Record<string, unknown>;
      if (value.recipient && typeof value.recipient === 'object' && Array.isArray(value.wishes)) {
        const recipient = value.recipient as Record<string, unknown>;
        // Explicit allowlists keep codes, hashes, provider fields and unrelated
        // recipients out of responses even if a future RPC adds database fields.
        return {
          authenticated: true,
          recipient: {
            id: requiredString(recipient.id), fullName: requiredString(recipient.fullName), displayName: requiredString(recipient.displayName),
            image: requiredString(recipient.image), introduction: requiredString(recipient.introduction), personality: requiredString(recipient.personality),
            ...(typeof recipient.memory === 'string' ? { memory: recipient.memory } : {}),
          },
          wishes: value.wishes.map((wish: unknown) => {
            if (!wish || typeof wish !== 'object') throw new Error('Invalid private wish projection');
            const row = wish as Record<string, unknown>;
            return { id: requiredString(row.id), title: requiredString(row.title), senderName: requiredString(row.senderName), message: requiredString(row.message) };
          }),
        };
      }
    }
  }
  writeCookie(request, response);
  throw new HttpError(401, 'Cậu đăng nhập để xem lời chúc của mình nhé.', 'RECIPIENT_SESSION_REQUIRED');
}

export async function recipientLogout(request: ApiRequest, response: ServerResponse) {
  const token = currentToken(request);
  // Revoke remotely before reporting success. A storage failure leaves logout
  // retryable rather than claiming the still-live server session was revoked.
  if (token) await rpc('dm66_recipient_logout', { p_session_hash: tokenHash(token) });
  writeCookie(request, response);
  return { authenticated: false };
}
