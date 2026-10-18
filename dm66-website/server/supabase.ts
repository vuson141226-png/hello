import { createHmac } from 'node:crypto';
import type { ApiRequest } from './http.js';
import { HttpError } from './http.js';

export function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new HttpError(503, 'Chức năng gửi thư chưa được kết nối hệ thống lưu trữ. Vui lòng thử lại sau.', 'NOT_CONFIGURED');
  }
  return { url, anonKey, serviceKey };
}

export class ProviderError extends Error {
  constructor(public status: number, public detail: Record<string, unknown>) { super('Storage provider request failed'); }
}

export async function provider(path: string, options: RequestInit = {}, privileged = true): Promise<{ data: unknown; headers: Headers }> {
  const config = configuration();
  const key = privileged ? config.serviceKey : config.anonKey;
  // Proxy-bound keys are opaque locally. An explicit format allows a legacy JWT
  // binding to populate both headers without trying to inspect its secret value.
  const legacyKey = process.env.SUPABASE_KEY_FORMAT === 'legacy'
    || (process.env.SUPABASE_KEY_FORMAT !== 'modern' && key.split('.').length === 3);
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    // Legacy keys are JWTs; modern sb_secret_/sb_publishable_ keys belong only
    // in apikey. Actual user access tokens explicitly override Authorization.
    headers: { apikey: key, ...(legacyKey ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new ProviderError(response.status, data && typeof data === 'object' ? data as Record<string, unknown> : {});
  return { data, headers: response.headers };
}

/** Only a keyed digest is persisted; the database never receives a visitor's raw IP. */
export function ipDigest(request: ApiRequest) {
  const { serviceKey } = configuration();
  // Vercel overwrites x-forwarded-for at its trusted edge. Local dev uses socket IP.
  const forwarded = request.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
  return createHmac('sha256', serviceKey).update(`dm66-rate-limit:${ip}`).digest('hex');
}

export async function rpc(name: string, values: Record<string, unknown>) {
  return (await provider(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(values) })).data;
}
