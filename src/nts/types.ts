import { z } from 'zod';

// 진위확인 요청 — p_nm, start_dt 는 개인정보/폐기 대상. 캐시 금지(도메인 원칙).
export const ValidateItemInputSchema = z.object({
  b_no: z.string().regex(/^\d{10}$/),
  start_dt: z.string().regex(/^\d{8}$/),
  p_nm: z.string().min(1),
  p_nm2: z.string().optional().default(''),
  b_nm: z.string().optional().default(''),
  corp_no: z.string().optional().default(''),
  b_sector: z.string().optional().default(''),
  b_type: z.string().optional().default(''),
  b_adr: z.string().optional().default(''),
});

// 진위확인 결과 — request_param 을 미선언하여 API 응답의 p_nm/start_dt echo 를 자동 폐기(strip).
export const ValidateResultItemSchema = z.object({
  b_no: z.string(),
  valid: z.enum(['01', '02']), // 01 일치 / 02 불일치
  valid_msg: z.string().optional(),
});
export const ValidateResponseSchema = z.object({
  status_code: z.string(),
  request_cnt: z.number().int(),
  valid_cnt: z.number().int().optional(),
  data: z.array(ValidateResultItemSchema),
});

// 상태조회 결과
export const StatusResultItemSchema = z.object({
  b_no: z.string(),
  b_stt: z.string().nullable().optional(), // 계속사업자/휴업자/폐업자
  b_stt_cd: z.string().nullable().optional(), // 01/02/03
  tax_type: z.string().nullable().optional(),
  tax_type_cd: z.string().nullable().optional(),
  end_dt: z.string().nullable().optional(), // 폐업일(YYYYMMDD)
  utcc_yn: z.string().nullable().optional(),
  tax_type_change_dt: z.string().nullable().optional(),
  invoice_apply_dt: z.string().nullable().optional(),
  rbf_tax_type: z.string().nullable().optional(),
  rbf_tax_type_cd: z.string().nullable().optional(),
});
export const StatusResponseSchema = z.object({
  status_code: z.string(),
  request_cnt: z.number().int(),
  match_cnt: z.number().int(),
  data: z.array(StatusResultItemSchema),
});

export type ValidateItemInput = z.infer<typeof ValidateItemInputSchema>;
export type ValidateResultItem = z.infer<typeof ValidateResultItemSchema>;
export type ValidateResponse = z.infer<typeof ValidateResponseSchema>;
export type StatusResultItem = z.infer<typeof StatusResultItemSchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
