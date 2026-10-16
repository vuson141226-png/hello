import type { ServerResponse } from 'node:http';
import type { ApiRequest } from './http.js';
import { HttpError } from './http.js';
import { configuration, ipDigest, ProviderError, provider, rpc } from './supabase.js';

const accessCookie = 'dm66_admin_access';
const refreshCookie = 'dm66_admin_refresh';
type Tokens = { access_token: string; refresh_token: string; expires_in: number; user?: { id: string; email?: string } };

function cookies(request: ApiRequest) {
  const result: Record<string, string> = {};
  for (const pair of (request.headers.cookie || '').split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    try { result[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1)); } catch { /* Ignore malformed cookies. */ }
  }
  return result;
}

function writeCookies(request: ApiRequest, response: ServerResponse, tokens?: Tokens) {
  const host = request.headers.host || '';
  const secure = request.headers['x-forwarded-proto'] === 'https' || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const suffix = `; Path=/api/admin; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
  response.setHeader('Set-Cookie', [
    `${accessCookie}=${tokens ? encodeURIComponent(tokens.access_token) : ''}; Max-Age=${tokens ? Math.max(1, Math.min(tokens.expires_in, 86400)) : 0}${suffix}`,
    `${refreshCookie}=${tokens ? encodeURIComponent(tokens.refresh_token) : ''}; Max-Age=${tokens ? 60 * 60 * 24 * 7 : 0}${suffix}`,
  ]);
}

export function clearSession(request: ApiRequest, response: ServerResponse) {
  writeCookies(request, response);
}

async function allowedAdmin(id: string) {
  const { data } = await provider(`/rest/v1/dm66_admins?user_id=eq.${encodeURIComponent(id)}&select=user_id&limit=1`);
  return Array.isArray(data) && data.length === 1;
}

async function authUser(token: string): Promise<{ id: string; email?: string }> {
  const { data } = await provider('/auth/v1/user', { headers: { Authorization: `Bearer ${token}` } }, false);
  if (!data || typeof data !== 'object' || typeof (data as { id?: unknown }).id !== 'string') throw new HttpError(401, 'Vui lòng đăng nhập quản trị.');
  return data as { id: string; email?: string };
}

export async function requireAdmin(request: ApiRequest, response: ServerResponse) {
  configuration();
  const current = cookies(request);
  let user: { id: string; email?: string } | undefined;
  let refreshed: Tokens | undefined;
  if (current[accessCookie]) {
    try { user = await authUser(current[accessCookie]); }
    catch (error) {
      if (!(error instanceof ProviderError) || ![401, 403].includes(error.status)) throw error;
    }
  }
  if (!user && current[refreshCookie]) {
    try {
      const { data } = await provider('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: current[refreshCookie] }) }, false);
      refreshed = data as Tokens;
      if (!refreshed.access_token || !refreshed.refresh_token) throw new HttpError(401, 'Vui lòng đăng nhập quản trị.');
      user = await authUser(refreshed.access_token);
    } catch (error) {
      if (error instanceof ProviderError && [400, 401, 403].includes(error.status)) {
        clearSession(request, response);
        throw new HttpError(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      throw error;
    }
  }
  if (!user || !(await allowedAdmin(user.id))) {
    clearSession(request, response);
    throw new HttpError(401, 'Vui lòng đăng nhập quản trị.');
  }
  if (refreshed) writeCookies(request, response, refreshed);
  return { email: user.email || '', id: user.id };
}

export async function login(request: ApiRequest, response: ServerResponse, body: Record<string, unknown>) {
  configuration();
  const withinLimit = await rpc('dm66_check_login_limit', { p_ip_hash: ipDigest(request) });
  if (withinLimit !== true) throw new HttpError(429, 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 10 phút.', undefined, 600);
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length > 254 || body.password.length > 1024 || !body.email.trim() || !body.password) {
    throw new HttpError(401, 'Thông tin đăng nhập không hợp lệ.');
  }
  try {
    const { data } = await provider('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: body.email.trim(), password: body.password }) }, false);
    const tokens = data as Tokens;
    if (!tokens.access_token || !tokens.refresh_token) throw new HttpError(401, 'Thông tin đăng nhập không hợp lệ.');
    const user = await authUser(tokens.access_token);
    if (!(await allowedAdmin(user.id))) {
      // Revoke this freshly-created unauthorized session instead of leaving it live.
      await provider('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}` } }, false).catch(() => undefined);
      throw new HttpError(401, 'Thông tin đăng nhập không hợp lệ.');
    }
    writeCookies(request, response, tokens);
    return { authenticated: true, email: user.email || '' };
  } catch (error) {
    if (error instanceof ProviderError && [400, 401, 403, 422].includes(error.status)) throw new HttpError(401, 'Thông tin đăng nhập không hợp lệ.');
    throw error;
  }
}

export async function logout(request: ApiRequest, response: ServerResponse) {
  const current = cookies(request);
  clearSession(request, response);
  try {
    let access = current[accessCookie];
    // Access cookies expire before refresh cookies. Revoke the remote refresh
    // session as well when signing out in that state, rather than only clearing it locally.
    if (!access && current[refreshCookie]) {
      const { data } = await provider('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: current[refreshCookie] }) }, false);
      access = (data as Tokens).access_token;
    }
    if (access) await provider('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${access}` } }, false);
  } catch (error) {
    if (!(error instanceof ProviderError) || ![400, 401, 403].includes(error.status)) throw error;
  }
}
