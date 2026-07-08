#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { judgeEligibility } from './eligibility.js';
import { DemoClient } from './demo.js';
import { NtsError } from './nts/errors.js';
import { NtsClient } from './nts/client.js';
import { StatusCache } from './nts/cache.js';

// .env 로드(Node 내장, 의존성 無). 파일 없으면 무시.
try {
  (process.loadEnvFile as (path?: string) => void)();
} catch {
  // .env 없음 — 환경변수로만 동작
}

const server = new McpServer({ name: 'korea-business-verify', version: '0.0.0' });

// DEMO_MODE: 서비스키가 없거나 DEMO_MODE=1 이면 가상 사업자번호로 동작(네트워크 호출 無).
const serviceKey = process.env.NTS_SERVICE_KEY ?? '';
const isDemo = process.env.DEMO_MODE === '1' || serviceKey.length === 0;
const client = isDemo
  ? new DemoClient()
  : new NtsClient({ serviceKey, cache: new StatusCache() });

const DISCLAIMER =
  '국세청 공공데이터 기준의 참고 결과이며, 법적 효력이 있는 증명은 홈택스 발급 문서를 참조하세요.';

function text(obj: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(obj, null, 2) }],
    isError,
  };
}

async function handle(fn: () => Promise<unknown>) {
  try {
    return text(await fn());
  } catch (e) {
    if (e instanceof NtsError) return text({ error: e.code, message: e.message }, true);
    throw e;
  }
}

const digits = (s: string) => s.replace(/\D/g, '');

// 1. verify_business — 진위확인 (대표자명은 즉시 폐기, 캐시 금지)
server.registerTool(
  'verify_business',
  {
    description:
      '한국 사업자등록정보 진위확인. 국세청 등록정보와 입력(사업자번호·대표자명·개업일자)의 일치 여부. 대표자명은 검증 즉시 폐기되며 저장되지 않습니다.',
    inputSchema: z.object({
      business_no: z.string().describe('사업자등록번호 (하이픈 무관)'),
      representative_name: z.string().describe('대표자 성명'),
      opening_date: z.string().describe('개업일자 (YYYYMMDD)'),
    }),
  },
  async ({ business_no, representative_name, opening_date }) =>
    handle(async () => {
      const res = await client.validate([
        {
          b_no: digits(business_no),
          start_dt: opening_date,
          p_nm: representative_name,
          p_nm2: '',
          b_nm: '',
          corp_no: '',
          b_sector: '',
          b_type: '',
          b_adr: '',
        },
      ]);
      const r = res[0];
      const matched = r?.valid === '01';
      return {
        match: matched,
        result: matched ? '일치' : (r?.valid_msg ?? '불일치'),
        basis:
          '국세청 진위확인 결과. 불일치 시 어느 필드가 다른지는 국세청이 제공하지 않습니다.',
        disclaimer: DISCLAIMER,
      };
    }),
);

// 2. check_business_status — 휴폐업·과세유형 (상태조회, 별도 활용신청 필요)
server.registerTool(
  'check_business_status',
  {
    description: '사업자 휴폐업 상태·과세유형·폐업일자 조회. 호출 빈도가 가장 높은 도구.',
    inputSchema: z.object({ business_no: z.string().describe('사업자등록번호') }),
  },
  async ({ business_no }) =>
    handle(async () => {
      const res = await client.statuses([digits(business_no)]);
      return { ...(res[0] ?? { b_no: digits(business_no) }), disclaimer: DISCLAIMER };
    }),
);

// 3. batch_check_status — 최대 100건 일괄
server.registerTool(
  'batch_check_status',
  {
    description: '최대 100건 사업자 상태 일괄 조회. 경비처리·정산 자동화용.',
    inputSchema: z.object({
      business_numbers: z.array(z.string()).max(100).describe('사업자번호 목록 (최대 100)'),
    }),
  },
  async ({ business_numbers }) =>
    handle(async () => {
      const data = await client.statuses(business_numbers.map(digits));
      return { count: data.length, data, disclaimer: DISCLAIMER };
    }),
);

// 4. check_invoice_eligibility — 세금계산서 발행 가능 판정 (상태조회 기반)
server.registerTool(
  'check_invoice_eligibility',
  {
    description:
      '과세유형·휴폐업 상태를 종합해 세금계산서 수취 가능 여부 판정 + 근거. 순수 래퍼 대비 차별화 도구.',
    inputSchema: z.object({ business_no: z.string().describe('사업자등록번호') }),
  },
  async ({ business_no }) =>
    handle(async () => {
      const res = await client.statuses([digits(business_no)]);
      return judgeEligibility(res[0] ?? { b_no: digits(business_no) });
    }),
);

// 5. explain_kr_tax_type — 과세유형 해설 (정적 지식, API 호출 無)
const TAX_GUIDE = {
  일반과세자: '부가가치세 일반과세자. 매출액이 기준(법인 8천만원 등)을 초과하면 의무 과세. 세금계산서 발행·수취 의무.',
  간이과세자: '부가가치세 간이과세자. 2023년부터 연매출 8천만원 이상 간이과세자도 세금계산서 발행 의무.',
  면세사업자: '부가가치세 면세 사업자. 세금계산서가 아닌 계산서(또는 영수증) 거래.',
  비과세사업자: '부가가치세 비과세 사업(의료·금융 등). 거래 성격에 따라 별도 확인 필요.',
} as const;

function explainTaxType(t?: string) {
  if (!t) return { guide: TAX_GUIDE, disclaimer: DISCLAIMER };
  const norm = t.replace(/\s/g, '');
  for (const [k, v] of Object.entries(TAX_GUIDE)) {
    const core = k.replace('과세자', '').replace('사업자', '');
    if (norm.includes(core)) return { tax_type: t, meaning: v, disclaimer: DISCLAIMER };
  }
  return { tax_type: t, meaning: '해당 과세유형 정보가 없습니다.', guide: TAX_GUIDE, disclaimer: DISCLAIMER };
}

server.registerTool(
  'explain_kr_tax_type',
  {
    description: '한국 과세유형(일반/간이/면세/비과세)의 실무 의미 해설. API 호출 없음.',
    inputSchema: z.object({ tax_type: z.string().optional().describe('과세유형 문자열 (생략 시 전체 목록)') }),
  },
  async ({ tax_type }) => text(explainTaxType(tax_type)),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `korea-business-verify MCP Server running on stdio (5 tools)${isDemo ? ' [DEMO 모드 — 가상 사업자번호]' : ''}`,
  );
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
