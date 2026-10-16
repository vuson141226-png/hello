import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import type { Server } from 'node:http';
import submit from '../api/letters.js';
import login from '../api/admin/login.js';
import logout from '../api/admin/logout.js';
import session from '../api/admin/session.js';
import list from '../api/admin/letters.js';
import download from '../api/admin/export.js';
import type { ApiHandler } from './http.js';
import { exportCsv, validateSubmission } from './letters.js';

const uuid = '43ab533d-f018-480e-95ea-064bde522ec9';
const stored = { id: uuid, sender_name: 'Phương', message: 'Cảm ơn các cậu 💗', created_at: '2026-10-20T02:30:00Z', status: 'saved' };
const tokens = { access_token: 'private-access-token', refresh_token: 'private-refresh-token', expires_in: 3600 };
const mockFetch = vi.fn<typeof fetch>();
const routes: Record<string, ApiHandler> = { '/api/letters': submit, '/api/admin/login': login, '/api/admin/logout': logout, '/api/admin/session': session, '/api/admin/letters': list, '/api/admin/export': download };
let server: Server;
let port: number;

function providerJson(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function call(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string; raw?: string } = {}) {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string; data: Record<string, unknown> }>((resolve, reject) => {
    const raw = options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
    const request = httpRequest({
      hostname: '127.0.0.1', port, path, method: options.method || 'GET',
      headers: { Origin: options.origin ?? `http://127.0.0.1:${port}`, ...(raw === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) }), ...(options.cookie ? { Cookie: options.cookie } : {}) },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(text) as Record<string, unknown>; } catch { /* CSV is not JSON. */ }
        resolve({ status: response.statusCode || 0, headers: response.headers, text, data });
      });
    });
    request.on('error', reject);
    request.end(raw);
  });
}

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
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('letter validation and durable-write API contract', () => {
  it('normalizes names, supports Unicode code points, and validates bounds', () => {
    expect(validateSubmission({ senderName: '  ', message: ' Xin chào ', submissionId: uuid })).toEqual({ senderName: 'Một cô gái DM66D', message: 'Xin chào', submissionId: uuid });
    expect(validateSubmission({ message: '🌷'.repeat(2000), submissionId: uuid }).message).toHaveLength(4000);
    for (const body of [
      { message: 'abcd', submissionId: uuid },
      { message: 'a'.repeat(2001), submissionId: uuid },
      { message: 'Xin chào', senderName: 'a'.repeat(101), submissionId: uuid },
      { message: 'Xin chào', senderName: 'a\nb', submissionId: uuid },
      { message: 'Xin chào', submissionId: 'not-a-uuid' },
      { message: 'Xin chào', submissionId: uuid, website: 'spam' },
    ]) expect(() => validateSubmission(body)).toThrow();
  });

  it('rejects cross-origin requests and oversized bodies before contacting storage', async () => {
    expect((await call('/api/letters', { method: 'POST', origin: 'https://unrelated.invalid', body: {} })).status).toBe(403);
    expect((await call('/api/letters', { method: 'POST', raw: JSON.stringify({ message: 'x'.repeat(17000) }) })).status).toBe(413);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('explicitly fails when storage is not configured instead of reporting saved', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const result = await call('/api/letters', { method: 'POST', body: { message: 'Xin chào', submissionId: uuid } });
    expect(result.status).toBe(503);
    expect(result.data.code).toBe('NOT_CONFIGURED');
    expect(result.data).not.toHaveProperty('letter');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns saved only after the database RPC confirms and sends a hashed IP', async () => {
    mockFetch.mockResolvedValue(providerJson([{ ...stored, replayed: false }]));
    const result = await call('/api/letters', { method: 'POST', body: { senderName: ' Phương ', message: stored.message, submissionId: uuid } });
    expect(result.status).toBe(201);
    expect(result.data.letter).toEqual({ id: uuid, senderName: 'Phương', message: stored.message, createdAt: stored.created_at, status: 'saved' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/rest/v1/rpc/dm66_submit_letter');
    const payload = JSON.parse(String(init?.body));
    expect(payload.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(String(init?.body)).not.toContain('127.0.0.1');
    expect(result.headers['cache-control']).toContain('no-store');
  });

  it('marks an idempotent database retry as 200', async () => {
    mockFetch.mockResolvedValue(providerJson([{ ...stored, replayed: true }]));
    expect((await call('/api/letters', { method: 'POST', body: { message: stored.message, submissionId: uuid } })).status).toBe(200);
  });

  it('does not claim saved for provider failures, invalid results, limits or ID conflicts', async () => {
    for (const [providerBody, providerStatus, status] of [
      [{ message: 'DM66_RATE_LIMIT' }, 400, 429],
      [{ message: 'DM66_SUBMISSION_CONFLICT' }, 400, 409],
      [{ message: 'secret database detail' }, 500, 503],
      [[], 200, 503],
    ] as const) {
      mockFetch.mockResolvedValueOnce(providerJson(providerBody, providerStatus));
      const result = await call('/api/letters', { method: 'POST', body: { message: stored.message, submissionId: uuid } });
      expect(result.status).toBe(status);
      expect(result.data).not.toHaveProperty('letter');
      expect(result.text).not.toContain('secret database detail');
    }
  });
});

describe('administrator authorization and exports', () => {
  it('rejects unauthenticated list/export requests without reading the database', async () => {
    for (const path of ['/api/admin/session', '/api/admin/letters', '/api/admin/export?format=json']) {
      expect((await call(path)).status).toBe(401);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('denies an authenticated Supabase user outside the administrator allowlist', async () => {
    mockFetch.mockResolvedValueOnce(providerJson({ id: uuid, email: 'user@example.invalid' })).mockResolvedValueOnce(providerJson([]));
    const result = await call('/api/admin/letters', { cookie: 'dm66_admin_access=user-token' });
    expect(result.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('rate limits logins before authentication and uses generic credential failures', async () => {
    mockFetch.mockResolvedValueOnce(providerJson(false));
    expect((await call('/api/admin/login', { method: 'POST', body: { email: 'admin@example.invalid', password: 'wrong' } })).status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    mockFetch.mockResolvedValueOnce(providerJson(true)).mockResolvedValueOnce(providerJson({ message: 'User not found' }, 400));
    const result = await call('/api/admin/login', { method: 'POST', body: { email: 'admin@example.invalid', password: 'wrong' } });
    expect(result.status).toBe(401);
    expect(result.text).not.toContain('User not found');
  });

  it('creates only HttpOnly same-site cookies after verifying the admin allowlist', async () => {
    mockFetch.mockResolvedValueOnce(providerJson(true)).mockResolvedValueOnce(providerJson(tokens)).mockResolvedValueOnce(providerJson({ id: uuid, email: 'admin@example.invalid' })).mockResolvedValueOnce(providerJson([{ user_id: uuid }]));
    const result = await call('/api/admin/login', { method: 'POST', body: { email: 'admin@example.invalid', password: 'test-password' } });
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ authenticated: true, email: 'admin@example.invalid' });
    expect(result.text).not.toContain(tokens.access_token);
    for (const cookie of result.headers['set-cookie'] || []) {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/admin');
    }
  });

  it('refreshes an expired token and checks the allowlist before returning a session', async () => {
    mockFetch.mockResolvedValueOnce(providerJson({}, 401)).mockResolvedValueOnce(providerJson(tokens)).mockResolvedValueOnce(providerJson({ id: uuid, email: 'admin@example.invalid' })).mockResolvedValueOnce(providerJson([{ user_id: uuid }]));
    const result = await call('/api/admin/session', { cookie: 'dm66_admin_access=expired; dm66_admin_refresh=refresh' });
    expect(result.status).toBe(200);
    expect(result.data.authenticated).toBe(true);
    expect(result.headers['set-cookie']).toHaveLength(2);
    expect(mockFetch.mock.calls[1][0]).toContain('grant_type=refresh_token');
  });

  it('lists and exports only after authorizing, including UTF-8 CSV formula escaping', async () => {
    for (const format of ['csv', 'json']) {
      mockFetch.mockResolvedValueOnce(providerJson({ id: uuid })).mockResolvedValueOnce(providerJson([{ user_id: uuid }])).mockResolvedValueOnce(providerJson([{ ...stored, sender_name: '=HYPERLINK("bad")', message: '+cmd\nCảm ơn' }], 200, { 'content-range': '0-0/1' }));
      const result = await call(`/api/admin/export?format=${format}&order=oldest`, { cookie: 'dm66_admin_access=valid' });
      expect(result.status).toBe(200);
      expect(result.headers['content-disposition']).toBe(`attachment; filename="DM66_Loi_Nhan_20_10.${format}"`);
      expect(result.headers['cache-control']).toContain('no-store');
      if (format === 'csv') {
        expect(result.text.charCodeAt(0)).toBe(0xfeff);
        expect(result.text).toContain("'=HYPERLINK");
        expect(result.text).toContain("'+cmd");
        expect(result.text).toContain('Cảm ơn');
      } else {
        expect(JSON.parse(result.text)).toHaveLength(1);
        expect(JSON.parse(result.text)[0].status).toBe('saved');
      }
    }
    expect(mockFetch.mock.calls[2][0]).toContain('created_at.asc');
  });

  it('clears session cookies and revokes access on logout', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await call('/api/admin/logout', { method: 'POST', cookie: 'dm66_admin_access=valid' });
    expect(result.status).toBe(200);
    expect(result.data.authenticated).toBe(false);
    expect((result.headers['set-cookie'] as string[]).every(cookie => cookie.includes('Max-Age=0'))).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/auth/v1/logout');
  });

  it('escapes quotes, newlines and whitespace-prefixed formulas in CSV', () => {
    const result = exportCsv([{ id: uuid, senderName: '  =1+1', message: '"chào"\nxin chào', createdAt: stored.created_at, status: 'saved' }]);
    expect(result).toContain("'  =1+1");
    expect(result).toContain('""chào""\nxin chào');
  });
});
