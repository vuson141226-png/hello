import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiHandler = (request: ApiRequest, response: ServerResponse) => Promise<void>;

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public retryAfterSeconds?: number) {
    super(message);
  }
}

export function json(response: ServerResponse, status: number, data: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

export function noStore(response: ServerResponse) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

export function endpoint(method: string, run: ApiHandler): ApiHandler {
  return async (request, response) => {
    noStore(response);
    try {
      if (request.method !== method) {
        response.setHeader('Allow', method);
        throw new HttpError(405, 'Phương thức không được hỗ trợ.');
      }
      if (method !== 'GET') requireSameOrigin(request);
      await run(request, response);
    } catch (error) {
      if (response.writableEnded) return;
      if (error instanceof HttpError) {
        if (error.status === 429) response.setHeader('Retry-After', String(error.retryAfterSeconds || 60));
        json(response, error.status, { error: error.message, ...(error.code ? { code: error.code } : {}) });
      } else {
        // Do not expose database, credential, or authentication provider errors.
        json(response, 503, { error: 'Hệ thống đang bận. Cậu thử lại sau nhé.', code: 'SERVICE_UNAVAILABLE' });
      }
    }
  };
}

export function requireSameOrigin(request: ApiRequest) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host || request.headers['sec-fetch-site'] === 'cross-site') {
    throw new HttpError(403, 'Yêu cầu không hợp lệ.');
  }
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('origin');
    if (request.headers['x-forwarded-proto'] === 'https' && parsed.protocol !== 'https:') throw new Error('protocol');
  } catch {
    throw new HttpError(403, 'Yêu cầu không hợp lệ.');
  }
}

export async function readJson(request: ApiRequest): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Vui lòng gửi dữ liệu JSON.');
  }
  const maximum = 16 * 1024;
  if (Number(request.headers['content-length'] || 0) > maximum) throw new HttpError(413, 'Nội dung quá dài.');
  let raw: string;
  if (request.body !== undefined) {
    raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
  } else {
    raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size <= maximum) chunks.push(bytes);
      });
      request.on('end', () => size > maximum ? reject(new HttpError(413, 'Nội dung quá dài.')) : resolve(Buffer.concat(chunks).toString('utf8')));
      request.on('error', reject);
      request.on('aborted', () => reject(new HttpError(400, 'Yêu cầu đã bị ngắt.')));
    });
  }
  if (Buffer.byteLength(raw) > maximum) throw new HttpError(413, 'Nội dung quá dài.');
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.');
  }
}
