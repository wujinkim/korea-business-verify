// check_invoice_eligibility 판정 로직 — 순수 함수. 스펙은 docs/rules.md.
// 도메인 원칙: 결과에 반드시 basis(근거) 동봉. 참고 판정이며 세무 자문 아님.

export type InvoiceEligibility =
  | 'TAX_INVOICE_OK'
  | 'CASH_INVOICE_EXEMPT'
  | 'UNAVAILABLE'
  | 'SUSPENDED'
  | 'UNCLEAR';

export interface EligibilityInput {
  b_stt?: string | null; // 계속사업자/휴업자/폐업자
  b_stt_cd?: string | null; // 01/02/03
  tax_type?: string | null;
  tax_type_cd?: string | null;
}

export interface EligibilityResult {
  eligibility: InvoiceEligibility;
  label: string;
  basis: string;
  disclaimer: string;
}

export const DISCLAIMER =
  '국세청 공공데이터 기준의 참고 판정이며 세무 자문이 아닙니다. 법적 효력이 있는 증명은 홈택스 발급 문서를 참조하세요.';

const LABELS: Record<InvoiceEligibility, string> = {
  TAX_INVOICE_OK: '세금계산서 수취 가능',
  CASH_INVOICE_EXEMPT: '계산서 대상(면세사업자)',
  UNAVAILABLE: '발행 불가(폐업)',
  SUSPENDED: '휴업 중',
  UNCLEAR: '확인 필요',
};

type TaxClass = 'general' | 'simplified' | 'exempt' | 'nontaxable' | 'unknown';

function classifyTax(taxType?: string | null, taxTypeCd?: string | null): TaxClass {
  const t = (taxType ?? '').replace(/\s/g, '');
  if (t.includes('면세')) return 'exempt';
  if (t.includes('간이')) return 'simplified';
  if (t.includes('비과세')) return 'nontaxable';
  if (t.includes('일반')) return 'general';
  // tax_type_cd fallback
  switch (taxTypeCd) {
    case '1':
    case '01':
      return 'general';
    case '2':
    case '02':
      return 'simplified';
    case '3':
    case '03':
      return 'exempt';
    case '4':
    case '04':
      return 'nontaxable';
    default:
      return 'unknown';
  }
}

function result(eligibility: InvoiceEligibility, basis: string): EligibilityResult {
  return { eligibility, label: LABELS[eligibility], basis, disclaimer: DISCLAIMER };
}

/** 판정표(docs/rules.md) 구현. 상태 우선, 계속사업자는 과세유형 따라. */
export function judgeEligibility(input: EligibilityInput): EligibilityResult {
  const stt = input.b_stt_cd ?? '';
  if (stt === '03') return result('UNAVAILABLE', '폐업자는 세금계산서 발행이 불가능합니다.');
  if (stt === '02') return result('SUSPENDED', '휴업 중인 사업자입니다. 거래 제한 및 확인이 필요합니다.');

  const tax = classifyTax(input.tax_type, input.tax_type_cd);
  switch (tax) {
    case 'general':
      return result('TAX_INVOICE_OK', '일반과세자로 세금계산서 수취가 가능합니다.');
    case 'simplified':
      return result('TAX_INVOICE_OK', '간이과세자로 세금계산서 수취가 가능합니다(2023년 간이과세자 세금계산서 의무화).');
    case 'exempt':
      return result('CASH_INVOICE_EXEMPT', '면세사업자는 부가가치세 과세 대상이 아니어 세금계산서 대신 계산서가 발행됩니다.');
    case 'nontaxable':
      return result('UNCLEAR', '비과세사업자입니다. 거래 품목에 따라 확인이 필요합니다.');
    default:
      return result('UNCLEAR', '과세유형을 확인할 수 없습니다.');
  }
}
