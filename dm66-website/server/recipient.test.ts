import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import type { Server } from 'node:http';
import login from '../api/recipient/login.js';
import session from '../api/recipient/session.js';
import logout from '../api/recipient/logout.js';
import type { ApiHandler } from './http.js';
import { normalizeRecipientName, normalizeStudentCode } from './recipient.js';

const mockFetch = vi.fn<typeof fetch>();
const routes: Record<string, ApiHandler> = { '/api/recipient/login': login, '/api/recipient/session': session, '/api/recipient/logout': logout };
const token = 'a'.repeat(43);
const cookie = `dm66_recipient_session=${token}`;
const hash = createHash('sha256').update(token).digest('hex');
const privateSession = {
  recipient: { id: 'synthetic-a', fullName: 'Nguyễn Đặng An', displayName: 'An', image: '/images/portrait-placeholder.svg', introduction: 'Test profile', personality: '', memory: '', student_code: 'NEVER_EXPOSE_CODE', student_code_hash: 'NEVER_EXPOSE_HASH' },
  wishes: [{ id: 'synthetic-wish-2', title: 'Lời chúc 2', senderName: 'Người gửi mẫu', message: 'Synthetic wish two', recipient_id: 'NEVER_EXPOSE_OWNER' }, { id: 'synthetic-wish-1', title: 'Lời chúc 1', senderName: 'Người gửi mẫu', message: 'Synthetic wish one' }],
  student_code: 'NEVER_EXPOSE_TOP_LEVEL',
};
let server: Server;
let port: number;

function result(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
function call(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string; secure?: boolean } = {}) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string; data: Record<string, unknown> }>((resolve, reject) => {
    const raw = options.body === undefined ? undefined : JSON.stringify(options.body);
    const request = httpRequest({ hostname: '127.0.0.1', port, path, method: options.method || 'GET', headers: {
      Origin: options.origin ?? `${options.secure ? 'https' : 'http'}://127.0.0.1:${port}`,
      ...(options.secure ? { 'X-Forwarded-Proto': 'https' } : {}),
      ...(raw === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) }),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    } }, response => {
      let text = '';
      response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: response.headers, text, data: JSON.parse(text) as Record<string, unknown> }));
    });
    request.on('error', reject); request.end(raw);
  });
}
function providerBody(index = 0) { return JSON.parse(String(mockFetch.mock.calls[index][1]?.body)) as Record<string, unknown>; }

beforeAll(async () => {
  server = createServer((request, response) => {
    const handler = routes[new URL(request.url || '/', 'http://localhost').pathname];
    if (!handler) { response.writeHead(404).end(); return; }
    void handler(request, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP server address');
  port = address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.invalid');
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  vi.stubGlobal('fetch', mockFetch); mockFetch.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('private recipient API', () => {
  it('normalizes Vietnamese names and restricts student codes consistently', () => {
    expect(normalizeRecipientName('  NGUYỄN   Đặng An ')).toBe('nguyen dang an');
    expect(normalizeRecipientName('Nguye\u0302\u0303n Đa\u0323ng An')).toBe('nguyen dang an');
    expect(normalizeStudentCode('  sv-0001.ab_2  ')).toBe('SV-0001.AB_2');
    for (const value of ['', 'ab', 'a b', 'a\nb', 'ábc', 'a'.repeat(65)]) expect(normalizeStudentCode(value)).toBeNull();
  });

  it('checks credentials only on the server, issues an opaque secure cookie, and rotates sessions', async () => {
    mockFetch.mockResolvedValueOnce(result({ authenticated: true, student_code: 'NEVER_EXPOSE_CODE' }));
    const response = await call('/api/recipient/login', { method: 'POST', secure: true, cookie, body: { fullName: ' Nguyễn  Đặng An ', studentCode: ' sv-0001 ' } });
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ authenticated: true });
    const setCookie = response.headers['set-cookie']?.[0];
    expect(setCookie).toMatch(/^dm66_recipient_session=[A-Za-z0-9_-]{43}; Max-Age=28800; Path=\/api\/recipient; HttpOnly; SameSite=Strict; Secure$/);
    const issued = setCookie?.split(';')[0].split('=')[1];
    const body = providerBody();
    expect(body).toMatchObject({ p_normalized_name: 'nguyen dang an', p_student_code: 'SV-0001', p_previous_session_hash: hash });
    expect(body.p_session_hash).toBe(createHash('sha256').update(issued || '').digest('hex'));
    expect(body.p_session_hash).not.toBe(issued);
    expect(body.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.supabase.invalid/rest/v1/rpc/dm66_recipient_login');
    expect(response.headers['cache-control']).toBe('no-store, max-age=0');
  });

  it('uses one generic response for incorrect names, incorrect codes and malformed credentials', async () => {
    mockFetch.mockImplementation(async () => result({ authenticated: false }));
    const responses = await Promise.all([
      call('/api/recipient/login', { method: 'POST', body: { fullName: 'Unknown name', studentCode: 'SV-0001' } }),
      call('/api/recipient/login', { method: 'POST', body: { fullName: 'Nguyễn Đặng An', studentCode: 'WRONG' } }),
      call('/api/recipient/login', { method: 'POST', body: { fullName: 42, studentCode: 'a b' } }),
    ]);
    expect(responses.every(response => response.status === 401)).toBe(true);
    expect(new Set(responses.map(response => response.text)).size).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('returns persistent rate-limit failures without a session cookie', async () => {
    mockFetch.mockResolvedValueOnce(result({ authenticated: false, limited: true }));
    const response = await call('/api/recipient/login', { method: 'POST', body: { fullName: 'Synthetic name', studentCode: 'SYNTHETIC-001' } });
    expect(response.status).toBe(429); expect(response.headers['retry-after']).toBe('900');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('requires same-origin mutation requests and correct methods before contacting storage', async () => {
    expect((await call('/api/recipient/login', { method: 'POST', origin: 'https://elsewhere.invalid', body: { fullName: 'Example', studentCode: 'EXAMPLE' } })).status).toBe(403);
    expect((await call('/api/recipient/logout', { method: 'POST', cookie, origin: 'https://elsewhere.invalid' })).status).toBe(403);
    expect((await call('/api/recipient/login')).status).toBe(405);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch private data for absent, guessed or ambiguous cookies', async () => {
    for (const value of [undefined, 'recipient_id=synthetic-a', 'dm66_recipient_session=synthetic-a', `${cookie}; ${cookie}`]) {
      const response = await call('/api/recipient/session?recipientId=synthetic-a', { cookie: value });
      expect(response.status).toBe(401); expect(response.text).not.toContain('Synthetic wish');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('projects only the authenticated recipient and their wishes and ignores guessed recipient IDs', async () => {
    mockFetch.mockResolvedValueOnce(result(privateSession));
    const response = await call('/api/recipient/session?recipientId=synthetic-b', { cookie });
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ authenticated: true, recipient: { id: 'synthetic-a' }, wishes: [{ id: 'synthetic-wish-2' }, { id: 'synthetic-wish-1' }] });
    expect(response.text).not.toMatch(/NEVER_EXPOSE|student_code|synthetic-b|recipient_id/);
    expect(providerBody()).toEqual({ p_session_hash: hash });
  });

  it('rejects expired or remotely revoked sessions and clears the cookie', async () => {
    mockFetch.mockResolvedValueOnce(result(null));
    const response = await call('/api/recipient/session', { cookie });
    expect(response.status).toBe(401);
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0; Path=/api/recipient; HttpOnly; SameSite=Strict');
  });

  it('revokes the stored session before clearing its cookie on logout', async () => {
    mockFetch.mockResolvedValueOnce(result(null));
    const response = await call('/api/recipient/logout', { method: 'POST', cookie });
    expect(response.status).toBe(200); expect(response.data).toEqual({ authenticated: false });
    expect(response.headers['set-cookie']?.[0]).toContain('Max-Age=0');
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.supabase.invalid/rest/v1/rpc/dm66_recipient_logout');
    expect(providerBody()).toEqual({ p_session_hash: hash });
  });

  it('keeps storage errors private and does not falsely report successful revocation', async () => {
    mockFetch.mockResolvedValueOnce(result({ message: 'PRIVATE DATABASE DETAIL', student_code: 'PRIVATE CODE' }, 500));
    const response = await call('/api/recipient/logout', { method: 'POST', cookie });
    expect(response.status).toBe(503); expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.text).not.toMatch(/PRIVATE|student_code/);
  });
});
