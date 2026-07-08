import type { StatusCache } from './cache.js';
import { isValidBusinessNo } from './checksum.js';
import { fromHttpError, fromStatusCode, isRetryable, messageFor, NtsError } from './errors.js';
import { StatusResponseSchema, ValidateResponseSchema } from './types.js';
import type {
  StatusResultItem,
  ValidateItemInput,
  ValidateResultItem,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.odcloud.kr/api/nts-businessman/v1';
const PATH_VALIDATE = '/validate';
const PATH_STATUS = '/status'; // 단수 — 공식 + Koomook/PublicDataReader 교차검증 (R1)
const MAX_BATCH = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_MS = 200;

export interface NtsClientOptions {
  serviceKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  cache?: StatusCache; // statuses 전용. validate 는 사용하지 않음.
}

export class NtsClient {
  private readonly serviceKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cache?: StatusCache;

  constructor(opts: NtsClientOptions) {
    this.serviceKey = opts.serviceKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.cache = opts.cache;
  }

  /** 진위확인 — 캐시 사용 금지, 체크섬 선행, 응답의 request_param(PII echo) 폐기. */
  async validate(items: ValidateItemInput[]): Promise<ValidateResultItem[]> {
    if (items.length === 0) return [];
    if (items.length > MAX_BATCH) throw new NtsError('TOO_LARGE', messageFor('TOO_LARGE'));
    for (const it of items) {
      if (!isValidBusinessNo(it.b_no)) throw new NtsError('BUSINESS_NUMBER', messageFor('BUSINESS_NUMBER'));
    }
    const res = await this.post(PATH_VALIDATE, JSON.stringify({ businesses: items }), ValidateResponseSchema);
    return res.data; // request_param 은 스키마에 없어 폐기됨
  }

  /** 상태조회 — 24h 캐시 partition, 체크섬 선행, 100건 제한. */
  async statuses(bnos: string[]): Promise<StatusResultItem[]> {
    if (bnos.length === 0) return [];
    if (bnos.length > MAX_BATCH) throw new NtsError('TOO_LARGE', messageFor('TOO_LARGE'));
    const normalized = bnos.map((b) => b.replace(/\D/g, ''));
    for (const b of normalized) {
      if (!isValidBusinessNo(b)) throw new NtsError('BUSINESS_NUMBER', messageFor('BUSINESS_NUMBER'));
    }

    // 캐시 partition: hit 은 스킵, miss 만 호출(쿼터 절약).
    const results = new Map<string, StatusResultItem>();
    const miss: string[] = [];
    if (this.cache) {
      for (const b of normalized) {
        const hit = this.cache.get(b);
        if (hit) results.set(b, hit);
        else miss.push(b);
      }
    } else {
      miss.push(...normalized);
    }

    if (miss.length > 0) {
      const res = await this.post(PATH_STATUS, JSON.stringify({ b_no: miss }), StatusResponseSchema);
      for (const item of res.data) {
        results.set(item.b_no, item);
        this.cache?.set(item.b_no, item);
      }
    }

    return normalized.map((b) => results.get(b) ?? ({ b_no: b } satisfies StatusResultItem));
  }

  private async post<T>(
    path: string,
    body: string,
    schema: { parse: (x: unknown) => T },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}?serviceKey=${encodeURIComponent(this.serviceKey)}`;
    let attempt = 0;
    let lastErr: NtsError | undefined;
    while (attempt <= this.maxRetries) {
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: this.timeoutMs > 0 ? AbortSignal.timeout(this.timeoutMs) : undefined,
        });
        if (res.status >= 500) throw fromHttpError(res.status);
        const json = await res.json();
        if (typeof json === 'object' && json !== null) {
          const j = json as Record<string, unknown>;
          // 에러 형태 1: { code: -3, msg } — 인증/서비스 미등록(공공데이터 공통)
          if (typeof j.code === 'number') throw fromStatusCode(String(j.code));
          // 에러 형태 2: { status_code: "REQUEST_DATA_MALFORMED" } — 비즈니스 에러
          if (typeof j.status_code === 'string' && j.status_code !== 'OK') {
            throw fromStatusCode(j.status_code);
          }
        }
        return schema.parse(json);
      } catch (err) {
        const ntsErr = toNtsError(err);
        lastErr = ntsErr;
        if (!isRetryable(ntsErr) || attempt >= this.maxRetries) break;
        await sleep(BACKOFF_MS * 2 ** attempt);
        attempt++;
      }
    }
    throw lastErr ?? new NtsError('UNKNOWN', messageFor('UNKNOWN'));
  }
}

function toNtsError(err: unknown): NtsError {
  if (err instanceof NtsError) return err;
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return new NtsError('TIMEOUT', messageFor('TIMEOUT'), { cause: err });
    }
    if (err instanceof TypeError || /ENOTFOUND|ECONNRESET|ECONNREFUSED|fetch failed/i.test(err.message)) {
      return new NtsError('NETWORK', messageFor('NETWORK'), { cause: err });
    }
  }
  return new NtsError('UNKNOWN', messageFor('UNKNOWN'), { cause: err });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
