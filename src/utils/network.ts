/**
 * Kaynaklara yapılan tüm HTTP istekleri buradan geçer.
 *
 * Görgü kuralları:
 * - Kendini tanıtan bir User-Agent kullanılır; tarayıcı taklidi yapılmaz.
 * - Aynı kaynağa ardışık istekler arasında en az `minDelayMs` beklenir.
 * - 5xx, timeout ve ağ hatalarında sınırlı sayıda exponential backoff ile tekrar denenir.
 * - 401/403 erişim reddidir: tekrar denenmez, kaynak "engellendi" olarak işaretlenir.
 * - 429'da hemen tekrar denenmez; Retry-After (yoksa varsayılan) kadar kaynak dinlendirilir.
 * - ETag / Last-Modified varsa koşullu istek yapılır; 304 "değişmedi" demektir.
 */

export const USER_AGENT = 'IlanTakip/0.1 (personal, non-commercial job tracker; Android)';

export type HttpErrorKind = 'network' | 'timeout' | 'blocked' | 'rateLimited' | 'notFound' | 'server' | 'http';

export class HttpError extends Error {
  constructor(
    public readonly kind: HttpErrorKind,
    message: string,
    public readonly status: number | null = null,
    /** 429 durumunda kaynağın dinlendirilmesi gereken süre. */
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  etag?: string | null;
  lastModified?: string | null;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  notModified: boolean;
  text: string;
  etag: string | null;
  lastModified: string | null;
  url: string;
}

export interface HttpClientOptions {
  minDelayMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function parseRetryAfter(value: string | null, nowMs: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

/** Kaynak başına bir örnek oluşturulur; istekleri sıraya koyar ve aralarında bekler. */
export class HttpClient {
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly minDelayMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  /** Geliştirici ekranı için son istek bilgisi. */
  lastRequest: { url: string; status: number | null; at: string } | null = null;

  constructor(opts: HttpClientOptions = {}) {
    this.minDelayMs = opts.minDelayMs ?? 1500;
    this.maxRetries = opts.maxRetries ?? 2;
    this.baseBackoffMs = opts.baseBackoffMs ?? 2000;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
    this.sleep = opts.sleep ?? defaultSleep;
    this.now = opts.now ?? Date.now;
  }

  request(req: HttpRequest): Promise<HttpResponse> {
    // İstekler sırayla çalışır; paralel çağrılar bile kaynağı aynı anda vurmaz.
    const run = this.queue.then(() => this.requestWithRetry(req));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async requestWithRetry(req: HttpRequest): Promise<HttpResponse> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.once(req);
      } catch (error) {
        const retryable = error instanceof HttpError && (error.kind === 'server' || error.kind === 'timeout' || error.kind === 'network');
        if (!retryable || attempt >= this.maxRetries) throw error;
        attempt++;
        await this.sleep(this.baseBackoffMs * 2 ** (attempt - 1));
      }
    }
  }

  private async once(req: HttpRequest): Promise<HttpResponse> {
    const wait = this.lastRequestAt + this.minDelayMs - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'tr-TR,tr;q=0.9',
      ...req.headers,
    };
    if (req.etag) headers['If-None-Match'] = req.etag;
    if (req.lastModified) headers['If-Modified-Since'] = req.lastModified;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 20_000);
    let res: Response;
    try {
      res = await this.fetchImpl(req.url, {
        method: req.method ?? 'GET',
        headers,
        body: req.body,
        signal: controller.signal,
      });
    } catch (error) {
      this.lastRequest = { url: req.url, status: null, at: new Date(this.now()).toISOString() };
      if (controller.signal.aborted) throw new HttpError('timeout', 'İstek zaman aşımına uğradı');
      throw new HttpError('network', `Ağ hatası: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
    this.lastRequest = { url: req.url, status: res.status, at: new Date(this.now()).toISOString() };

    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    if (res.status === 304) {
      return { status: 304, notModified: true, text: '', etag: etag ?? req.etag ?? null, lastModified: lastModified ?? req.lastModified ?? null, url: req.url };
    }
    if (res.status === 401 || res.status === 403) {
      throw new HttpError('blocked', `Erişim reddedildi (HTTP ${res.status})`, res.status);
    }
    if (res.status === 429) {
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'), this.now()) ?? 60 * 60_000;
      throw new HttpError('rateLimited', 'Çok fazla istek (HTTP 429)', 429, retryAfter);
    }
    if (res.status === 404 || res.status === 410) {
      throw new HttpError('notFound', `Bulunamadı (HTTP ${res.status})`, res.status);
    }
    if (res.status >= 500) {
      throw new HttpError('server', `Sunucu hatası (HTTP ${res.status})`, res.status);
    }
    if (res.status < 200 || res.status >= 300) {
      throw new HttpError('http', `Beklenmeyen yanıt (HTTP ${res.status})`, res.status);
    }
    return { status: res.status, notModified: false, text: await res.text(), etag, lastModified, url: res.url || req.url };
  }
}
