// 국세청 API 에러 → 도메인 에러 매핑. 메시지는 정적 한국어(PII 절대 불포함).

export type NtsErrorCode =
  | 'AUTH' // -401 serviceKey 누락/무효
  | 'SERVICE_NOT_ACTIVATED' // -3 미등록 서비스(별도 활용신청 필요)
  | 'MALFORMED' // REQUEST_DATA_MALFORMED / 4xx
  | 'BUSINESS_NUMBER' // 체크섬 실패
  | 'TOO_LARGE' // 100건 초과
  | 'SERVER' // 5xx
  | 'TIMEOUT'
  | 'NETWORK'
  | 'UNKNOWN';

export class NtsError extends Error {
  readonly code: NtsErrorCode;
  constructor(code: NtsErrorCode, message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.code = code;
    this.name = 'NtsError';
  }
}

const STATUS_CODE_MAP: Record<string, NtsErrorCode> = {
  '-3': 'SERVICE_NOT_ACTIVATED',
  '-401': 'AUTH',
  REQUEST_DATA_MALFORMED: 'MALFORMED',
};

const MESSAGES: Record<NtsErrorCode, string> = {
  AUTH: '국세청 API 인증에 실패했습니다. serviceKey를 확인하세요.',
  SERVICE_NOT_ACTIVATED: '국세청 서비스가 활성화되지 않았습니다. 공공데이터포털에서 해당 API 활용신청이 필요합니다.',
  MALFORMED: '국세청 API 요청 데이터 형식이 올바르지 않습니다.',
  BUSINESS_NUMBER: '올바르지 않은 사업자등록번호 형식입니다.',
  TOO_LARGE: '한 번에 조회 가능한 건수(100건)를 초과했습니다.',
  SERVER: '국세청 API 서버 오류가 발생했습니다.',
  TIMEOUT: '국세청 API 호출이 시간 초과되었습니다.',
  NETWORK: '국세청 API 네트워크 오류가 발생했습니다.',
  UNKNOWN: '국세청 API 호출 중 알 수 없는 오류가 발생했습니다.',
};

export function messageFor(code: NtsErrorCode): string {
  return MESSAGES[code];
}

/** 응답 최상위 status_code(OK 제외) → NtsError. code/msg 형태도 처리. */
export function fromStatusCode(statusCode: string): NtsError {
  const code = STATUS_CODE_MAP[statusCode] ?? 'UNKNOWN';
  return new NtsError(code, messageFor(code));
}

/** HTTP 상태 → NtsError. 5xx=SERVER, 4xx=MALFORMED. */
export function fromHttpError(status: number, cause?: unknown): NtsError {
  const code: NtsErrorCode = status >= 500 ? 'SERVER' : status >= 400 ? 'MALFORMED' : 'UNKNOWN';
  return new NtsError(code, messageFor(code), { cause });
}

export function isRetryable(err: NtsError): boolean {
  return err.code === 'SERVER' || err.code === 'TIMEOUT' || err.code === 'NETWORK';
}
