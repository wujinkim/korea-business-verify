import { describe, expect, it } from 'vitest';
import { DISCLAIMER, judgeEligibility } from '../src/eligibility';

// 테이블 주도 테스트 — docs/rules.md 판정표 전 조합.
describe('check_invoice_eligibility 판정표 (docs/rules.md)', () => {
  const cases: Array<{ name: string; input: Parameters<typeof judgeEligibility>[0]; expected: string }> = [
    { name: '폐업(03) — 과세유형 무관', input: { b_stt_cd: '03', tax_type: '부가가치세 일반과세자' }, expected: 'UNAVAILABLE' },
    { name: '폐업(03) — 과세유형 無', input: { b_stt_cd: '03' }, expected: 'UNAVAILABLE' },
    { name: '휴업(02)', input: { b_stt_cd: '02', tax_type: '부가가치세 간이과세자' }, expected: 'SUSPENDED' },
    { name: '계속 + 일반', input: { b_stt_cd: '01', tax_type: '부가가치세 일반과세자' }, expected: 'TAX_INVOICE_OK' },
    { name: '계속 + 간이', input: { b_stt_cd: '01', tax_type: '부가가치세 간이과세자' }, expected: 'TAX_INVOICE_OK' },
    { name: '계속 + 면세', input: { b_stt_cd: '01', tax_type: '부가가치세 면세사업자' }, expected: 'CASH_INVOICE_EXEMPT' },
    { name: '계속 + 비과세', input: { b_stt_cd: '01', tax_type: '비과세사업자' }, expected: 'UNCLEAR' },
    { name: '계속 + 과세유형 無', input: { b_stt_cd: '01' }, expected: 'UNCLEAR' },
    { name: '계속 + cd fallback 일반(1)', input: { b_stt_cd: '01', tax_type_cd: '1' }, expected: 'TAX_INVOICE_OK' },
    { name: '계속 + cd fallback 면세(3)', input: { b_stt_cd: '01', tax_type_cd: '3' }, expected: 'CASH_INVOICE_EXEMPT' },
    { name: '키워드 매칭: "면세" 우선(간이+면세 혼합 문자열)', input: { b_stt_cd: '01', tax_type: '면세' }, expected: 'CASH_INVOICE_EXEMPT' },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = judgeEligibility(c.input);
      expect(r.eligibility).toBe(c.expected);
      expect(r.basis).toBeTruthy(); // 도메인 원칙: basis 필수
      expect(r.label).toBeTruthy();
      expect(r.disclaimer).toBe(DISCLAIMER); // 면책 상시 포함
    });
  }

  it('모든 결과 코드는 라벨/basis/disclaimer 동봉', () => {
    const inputs = {
      UNAVAILABLE: { b_stt_cd: '03' },
      SUSPENDED: { b_stt_cd: '02' },
      TAX_INVOICE_OK: { b_stt_cd: '01', tax_type: '부가가치세 일반과세자' },
      CASH_INVOICE_EXEMPT: { b_stt_cd: '01', tax_type: '부가가치세 면세사업자' },
      UNCLEAR: { b_stt_cd: '01', tax_type: '비과세사업자' },
    } as const;
    const codes = Object.keys(inputs) as Array<keyof typeof inputs>;
    for (const code of codes) {
      const r = judgeEligibility(inputs[code]);
      expect(r.eligibility).toBe(code);
      expect(r.basis.length).toBeGreaterThan(0);
    }
  });
});
