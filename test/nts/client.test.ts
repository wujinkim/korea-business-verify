import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusCache } from '../../src/nts/cache';
import { NtsClient } from '../../src/nts/client';
import { NtsError } from '../../src/nts/errors';

// 테스트용 값은 환경변수로 주입 가능(기본값은 가상).
const TEST_BNO = process.env.TEST_BUSINESS_NO ?? '1111111119';
const TEST_BNO_2 = process.env.TEST_BUSINESS_NO_2 ?? '2222222227';
const TEST_REP = process.env.TEST_REP_NAME ?? 'REP_TEST';

// --- helpers ---
const mockRes = (jsonBody: unknown, status = 200): Response =>
  ({ status, json: async () => jsonBody }) as unknown as Response;

const okValidate = (bNo: string, extra: Record<string, unknown> = {}): unknown => ({
  status_code: 'OK',
  request_cnt: 1,
  valid_cnt: 1,
  data: [{ b_no: bNo, valid: '01', ...extra }],
});

const okStatus = (items: { b_no: string; b_stt?: string; b_stt_cd?: string }[]): unknown => ({
  status_code: 'OK',
  request_cnt: items.length,
  match_cnt: items.length,
  data: items.map((i) => ({ b_stt: '계속사업자', b_stt_cd: '01', ...i })),
});

const validInput = (bNo: string = TEST_BNO, pNm: string = TEST_REP) => ({
  b_no: bNo,
  start_dt: '20000101',
  p_nm: pNm,
  p_nm2: '',
  b_nm: '',
  corp_no: '',
  b_sector: '',
  b_type: '',
  b_adr: '',
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// AC2 — 장애 주입 우아한 실패 + 에러 매핑
// ============================================================
describe('AC2 에러 매핑/재시도', () => {
  it('HTTP 5xx → SERVER, 재시도 3회(초기+2) 후 throw', async () => {
    const fetchImpl = vi.fn(async () => mockRes({}, 503));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, maxRetries: 2 });
    await expect(client.validate([validInput()])).rejects.toMatchObject({ code: 'SERVER' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('AbortError → TIMEOUT (재시도)', async () => {
    const fetchImpl = vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, maxRetries: 1 });
    await expect(client.validate([validInput()])).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fetch failed(TypeError) → NETWORK', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, maxRetries: 0 });
    await expect(client.validate([validInput()])).rejects.toMatchObject({ code: 'NETWORK' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('status_code -3 → SERVICE_NOT_ACTIVATED, 재시도 안 함(1회)', async () => {
    const fetchImpl = vi.fn(async () => mockRes({ code: -3, msg: '등록되지 않은 서비스 입니다.' }));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl });
    await expect(client.statuses([TEST_BNO])).rejects.toMatchObject({ code: 'SERVICE_NOT_ACTIVATED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // 재시도 X
  });

  it('REQUEST_DATA_MALFORMED → MALFORMED, 재시도 안 함', async () => {
    const fetchImpl = vi.fn(async () => mockRes({ status_code: 'REQUEST_DATA_MALFORMED' }));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl });
    await expect(client.validate([validInput()])).rejects.toMatchObject({ code: 'MALFORMED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('101건 → TOO_LARGE (API 미호출)', async () => {
    const fetchImpl = vi.fn();
    const client = new NtsClient({ serviceKey: 'k', fetchImpl });
    const items = Array.from({ length: 101 }, () => validInput());
    await expect(client.validate(items)).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('체크섬 실패 → BUSINESS_NUMBER (API 미호출)', async () => {
    const fetchImpl = vi.fn();
    const client = new NtsClient({ serviceKey: 'k', fetchImpl });
    await expect(client.validate([validInput('1234567890')])).rejects.toMatchObject({ code: 'BUSINESS_NUMBER' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('정상 응답 → valid 결과 반환', async () => {
    const fetchImpl = vi.fn(async () => mockRes(okValidate(TEST_BNO)));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl });
    const res = await client.validate([validInput()]);
    expect(res).toEqual([{ b_no: TEST_BNO, valid: '01' }]);
  });
});

// ============================================================
// 캐시 partition (statuses)
// ============================================================
describe('statuses 캐시 partition', () => {
  it('hit 은 스킵, miss 만 fetch', async () => {
    const cache = new StatusCache();
    cache.set(TEST_BNO, { b_no: TEST_BNO, b_stt: '계속사업자', b_stt_cd: '01' }); // 캐시 hit
    const fetchImpl = vi.fn(async () => mockRes(okStatus([{ b_no: TEST_BNO_2 }])));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, cache });
    const res = await client.statuses([TEST_BNO, TEST_BNO_2]);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // miss 1건만
    expect(res).toHaveLength(2);
    expect(res[0]!.b_stt).toBe('계속사업자'); // 캐시
    expect(res[1]!.b_no).toBe(TEST_BNO_2); // fetch
  });
});

// ============================================================
// AC3 — PII(대표자명) 무잔류 검증 (3계층)
// ============================================================
describe('AC3 PII 무잔류', () => {
  const MARKER = 'PII_MARKER_김아무개_9f3k2';

  it('계층1: 응답 request_param echo 를 폐기 → 결과/로그/캐시 어디에도 마커 없음', async () => {
    // 모킹 응답이 NTS처럼 request_param 에 p_nm(start_dt) 을 echo.
    const fetchImpl = vi.fn(async () =>
      mockRes({
        status_code: 'OK',
        request_cnt: 1,
        valid_cnt: 1,
        data: [
          {
            b_no: TEST_BNO,
            valid: '01',
            request_param: { b_no: TEST_BNO, start_dt: '20000101', p_nm: MARKER }, // PII echo
          },
        ],
      }),
    );

    // stdout/stderr 캡처
    const captured: string[] = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...a: unknown[]) => captured.push(a.map(String).join(' '));
    console.error = (...a: unknown[]) => captured.push(a.map(String).join(' '));

    const cache = new StatusCache();
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, cache });
    const result = await client.validate([validInput(TEST_BNO, MARKER)]);

    console.log = origLog;
    console.error = origErr;

    const dump = [JSON.stringify(result), captured.join('\n'), JSON.stringify(cache.values())].join('\n');
    expect(dump).not.toContain(MARKER);
  });

  it('계층2a: validate 호출 후 cache.set 은 한 번도 호출되지 않음 (진위 캐시금지)', async () => {
    const cache = new StatusCache();
    const setSpy = vi.spyOn(cache, 'set');
    const fetchImpl = vi.fn(async () => mockRes(okValidate(TEST_BNO)));
    const client = new NtsClient({ serviceKey: 'k', fetchImpl, cache });
    await client.validate([validInput()]);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('계층2b: 소스에 request_param 식별자(주석 제외) 미등장', () => {
    const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const clientSrc = strip(readFileSync('src/nts/client.ts', 'utf8'));
    const typesSrc = strip(readFileSync('src/nts/types.ts', 'utf8'));
    expect(clientSrc).not.toContain('request_param');
    expect(typesSrc).not.toContain('request_param');
  });

  it('에러 메시지에 PII 미포함', () => {
    const err = new NtsError('MALFORMED', '국세청 API 요청 데이터 형식이 올바르지 않습니다.');
    expect(err.message).not.toContain(MARKER);
    expect(err.code).toBe('MALFORMED');
  });
});
