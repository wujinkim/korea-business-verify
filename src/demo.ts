// DEMO_MODE — 가상 사업자번호 셋으로 서비스키 없이 5종 도구 체험.
// 실번호 사용 금지(개인정보·오인 방지). 아래 번호는 체크섬은 유효하나 실제 존재 않는 가상 번호.
import type { StatusResultItem, ValidateItemInput, ValidateResultItem } from './nts/types.js';

export const DEMO_BUSINESSES = {
  // 일반과세자/계속사업자 → 세금계산서 발행 가능
  '1111111119': {
    b_stt: '계속사업자',
    b_stt_cd: '01',
    tax_type: '부가가치세 일반과세자',
    tax_type_cd: '01',
    end_dt: '',
  },
  // 면세사업자/계속사업자 → 계산서 대상
  '2222222227': {
    b_stt: '계속사업자',
    b_stt_cd: '01',
    tax_type: '부가가치세 면세사업자',
    tax_type_cd: '03',
    end_dt: '',
  },
  // 폐업자 → 발행 불가
  '3333333336': {
    b_stt: '폐업자',
    b_stt_cd: '03',
    tax_type: '부가가치세 일반과세자',
    tax_type_cd: '01',
    end_dt: '20250101',
  },
} as const satisfies Record<string, Omit<StatusResultItem, 'b_no'>>;

/** NtsClient 와 동일 인터페이스의 데모 구현. 네트워크 호출 없이 고정 fixture 반환. */
export class DemoClient {
  async validate(items: ValidateItemInput[]): Promise<ValidateResultItem[]> {
    return items.map((it) => {
      const known = it.b_no in DEMO_BUSINESSES;
      return {
        b_no: it.b_no,
        valid: known ? ('01' as const) : ('02' as const),
        valid_msg: known ? undefined : 'DEMO: 등록되지 않은 가상 번호',
      };
    });
  }

  async statuses(bnos: string[]): Promise<StatusResultItem[]> {
    return bnos.map((b) => {
      const v = DEMO_BUSINESSES[b as keyof typeof DEMO_BUSINESSES];
      return v ? ({ b_no: b, ...v } as StatusResultItem) : ({ b_no: b } as StatusResultItem);
    });
  }
}
