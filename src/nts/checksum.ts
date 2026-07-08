// 사업자번호 체크섬 — 국세청 호출 전 형식 검증(도메인 원칙 5, 쿼터·지연 절약).
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

/** 하이픈/공백 등 비숫자 제거 → 10자리 숫자. */
export function normalizeBusinessNo(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** 10자리 + 체크섬 검증. 가중치 [1,3,7,1,3,7,1,3,5], 9번째 자리는 floor(d*5/10) 추가. */
export function isValidBusinessNo(raw: string): boolean {
  const b = normalizeBusinessNo(raw);
  if (!/^\d{10}$/.test(b)) return false;
  const d = b.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += d[i]! * WEIGHTS[i]!;
  }
  sum += Math.floor((d[8]! * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === d[9];
}
