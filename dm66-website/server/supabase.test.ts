import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provider } from './supabase.js';

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubEnv('SUPABASE_URL', 'https://synthetic.supabase.invalid');
  vi.stubEnv('SUPABASE_ANON_KEY', 'sb_publishable_synthetic');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_synthetic');
  vi.stubEnv('SUPABASE_KEY_FORMAT', '');
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockImplementation(async () => new Response('[]', { status: 200 }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Supabase API credential headers', () => {
  it('sends modern API keys only through apikey', async () => {
    await provider('/rest/v1/synthetic');
    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_synthetic');
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('recognizes legacy JWT keys and accepts an explicit format for opaque proxy bindings', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic.jwt.value');
    await provider('/rest/v1/synthetic');
    expect(mockFetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer synthetic.jwt.value' });
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'opaque-synthetic-binding');
    vi.stubEnv('SUPABASE_KEY_FORMAT', 'legacy');
    await provider('/rest/v1/synthetic');
    expect(mockFetch.mock.calls[1][1]?.headers).toMatchObject({
      apikey: 'opaque-synthetic-binding', Authorization: 'Bearer opaque-synthetic-binding',
    });
  });

  it('preserves a user access token when authorizing admin sessions', async () => {
    vi.stubEnv('SUPABASE_KEY_FORMAT', 'legacy');
    await provider('/auth/v1/user', { headers: { Authorization: 'Bearer synthetic-user-token' } }, false);
    expect(mockFetch.mock.calls[0][1]?.headers).toMatchObject({
      apikey: 'sb_publishable_synthetic', Authorization: 'Bearer synthetic-user-token',
    });
  });
});
