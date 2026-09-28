import { HttpClient, HttpError, USER_AGENT } from '@/utils/network';

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
  return {
    status,
    url: 'https://example.gov.tr/',
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => body,
  } as unknown as Response;
}

function client(fetchImpl: jest.Mock, extra: { sleep?: jest.Mock } = {}) {
  const sleep = extra.sleep ?? jest.fn(async () => undefined);
  return { http: new HttpClient({ fetchImpl, sleep, minDelayMs: 0, baseBackoffMs: 100 }), sleep };
}

describe('HttpClient', () => {
  it('kendini tanıtan User-Agent ve koşullu istek başlıkları gönderir', async () => {
    const fetchImpl = jest.fn(async () => response(304));
    const { http } = client(fetchImpl);
    const r = await http.request({ url: 'https://example.gov.tr/rss', etag: '"abc"', lastModified: 'Fri, 25 Sep 2026 10:00:00 GMT' });
    expect(r.notModified).toBe(true);
    const headers = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['User-Agent']).toBe(USER_AGENT);
    expect(headers['If-None-Match']).toBe('"abc"');
    expect(headers['If-Modified-Since']).toBeTruthy();
  });

  it('5xx için exponential backoff ile sınırlı tekrar dener', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(502)).mockResolvedValueOnce(response(200, 'ok'));
    const { http, sleep } = client(fetchImpl);
    await expect(http.request({ url: 'https://x' })).resolves.toMatchObject({ text: 'ok' });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it('403 için tekrar denemez', async () => {
    const fetchImpl = jest.fn(async () => response(403));
    const { http } = client(fetchImpl);
    await expect(http.request({ url: 'https://x' })).rejects.toMatchObject({ kind: 'blocked', status: 403 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('429 için tekrar denemez, Retry-After süresini bildirir', async () => {
    const fetchImpl = jest.fn(async () => response(429, '', { 'retry-after': '120' }));
    const { http } = client(fetchImpl);
    const err = (await http.request({ url: 'https://x' }).catch((e: unknown) => e)) as HttpError;
    expect(err.kind).toBe('rateLimited');
    expect(err.retryAfterMs).toBe(120_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('404 tekrar denenmez', async () => {
    const fetchImpl = jest.fn(async () => response(404));
    const { http } = client(fetchImpl);
    await expect(http.request({ url: 'https://x' })).rejects.toMatchObject({ kind: 'notFound' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('ağ hatasında en fazla 2 kez tekrar dener', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const { http } = client(fetchImpl);
    await expect(http.request({ url: 'https://x' })).rejects.toMatchObject({ kind: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('ardışık istekler arasında bekler ve istekleri sıraya koyar', async () => {
    let t = 0;
    const sleep = jest.fn(async (ms: number) => {
      t += ms;
    });
    const fetchImpl = jest.fn(async () => response(200, 'ok'));
    const http = new HttpClient({ fetchImpl, sleep, minDelayMs: 1500, now: () => t });
    await Promise.all([http.request({ url: 'https://a' }), http.request({ url: 'https://b' })]);
    expect(sleep).toHaveBeenCalledWith(1500);
  });
});
