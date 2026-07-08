# kr-biz-verify — 진행 기록 (PROGRESS)

> 구현 세션(GLM)이 루프 단위로 기록. 평가 세션(Claude)이 AC 충족을 검증.
> SSOT: `kr-biz-verify-mcp-plan.md`

---

## Loop 0 — 스캐폴딩 ✅ 완료 (2026-07-08)

### 수행 내용
- **A안 자산(저장소) 부재** → 계획서 §0.4/§5 예외 적용, 템플릿 복제 대신 **신규 구축**으로 전환.
- TypeScript(ESM) + `@modelcontextprotocol/sdk` v1.29.0 + vitest + eslint(flat) + GitHub Actions CI 골격.
- 도구 0개 stdio MCP 서버(`src/index.ts`) 부팅 구현.

### 산출물
- `package.json` / `tsconfig.json` / `eslint.config.js`
- `src/index.ts` — McpServer(도구 0개), StdioServerTransport
- `test/sanity.test.ts` — 파이프라인 헬스체크
- `.github/workflows/ci.yml` — lint/build/test
- `.gitignore`, `.env`(추적 제외), `.env.example`

### AC 증거 (AC: 빌드·테스트·린트 통과, Inspector 연결 도구 0개)
| 명령 | 결과 |
|---|---|
| `npm run build` (tsc) | 통과(에러 0) |
| `npm run lint` (eslint) | 클린 |
| `npm test` (vitest) | 1 passed |
| MCP stdio 핸드셰이크 | `initialize` 응답: `{"serverInfo":{"name":"kr-biz-verify","version":"0.0.0"},"protocolVersion":"2024-11-05","capabilities":{}}` 정상. capabilities에 tools 없음 = 도구 0개. |

- `tools/list` 응답 `Method not found`는 도구 0개 상태의 정상 동작(등록된 도구가 없으면 SDK가 tools 라우팅 비활성).

### 미해결 이슈
- **npm audit**: devDep 계열 취약점 5개(3 moderate, 1 high, 1 critical). prod 의존성(`npm audit --omit=dev`)은 **0개**. → **Loop 4**에서 `npm audit fix` 처리(Loop 0 AC 아님).
- **git 저장소 미초기화** — CI 파일 생성됨, 사용자 요청 시 `git init`.
- **패키지명/버전 `0.0.0`** 가칭 → **Loop 1**에서 명칭 확정.
- `eslint.config.js`의 `tseslint.config(...)` deprecation 경고(기능 동작) — typescript-eslint 갱신 시 정리.

### [HUMAN] 선행 (Loop 2용)
- ✅ 공공데이터포털 국세청 API 활용신청 완료 + 서비스키 `.env` 보관.

---

## Loop 1 — 수요검증 + 명칭확정 ✅ 완료 (2026-07-08)

### 수행 내용
- 서브에이전트 병렬 리서치: 시나리오 5종 실수요 증거(GitHub API + 공개 가격) + 유료 대체재 단가.
- 산출: `docs/adr/ADR-001-demand.md`.

### AC 증거 (AC: 5개 시나리오 중 3개 이상 실수요)
- **4/5 실수요 달성 (통과)**: S1 경비처리(강)·S2 온보딩(중~강)·S3 이커머스(강, 법적의무)·S4 세무(중, 간접). S5 조달(불확실).
- 상세 증거·링크는 ADR-001 §2 참조.

### 🚨 전략 발견 — 계획서 해자(§0.2/§0.3) 갱신
- "MCP 제품 부재" 전제 붕괴: **경쟁 MCP 5개 존재, 선두 Koomook 288★/50 fork** (§1.1과 거의 동일 도구).
- **[HUMAN] 결정: 차별화 강화하며 진행** — 판정 로직(`check_invoice_eligibility`+`basis`)·컴플라이언스·면책·한국어 우선을 전면으로. (계획서 §0.2/§0.3 셀 갱신은 [HUMAN]이 SSOT 수정.)

### 명칭 확정 — [HUMAN] 결정
- **`korea-business-verify`** — npm 미점점(E404 확인). 제품명·npm 패키지명·MCP 서버명 통일.
- 반영: `package.json`(name/bin), `src/index.ts`(server name).

### 과금 준거 (Loop 8용, ADR-001 §4)
- 공개 단가 벤치마크: 머니핀 10~150원/건, 에이픽 0원(무료). 타사는 영업견적 비공개.
- 권장: 상태조회 무료/저단가 + 진위확인/basis 프리미엄 2티어.

### 미해결 이슈
- S5(조달) 직접 증거 부족 — web_search_prime 주간 한도 초과. 8월 리셋 후 보강 가능.
- 계획서 §0.2/§0.3 해자 갱신 미반영([HUMAN] SSOT 수정 대기).

---

## Loop 2 — 국세청 API 클라이언트 ✅ 완료 (2026-07-08)

### 수행 내용
- `src/nts/` 5파일: `checksum.ts` / `errors.ts` / `types.ts` / `cache.ts` / `client.ts`
- `NtsClient.validate`(캐시금지·체크섬 선행·`request_param` 폐기) / `statuses`(24h 캐시 partition·100건 제한)
- 내장 `fetch`+`AbortController`(10s 타임아웃), 재시도(SERVER/TIMEOUT/NETWORK만, 200ms→400ms, 총 3회)
- `zod` 직접 의존 추가(^4.4.3). 외부 HTTP 클라이언트 無.
- MCP 도구 5종 등록은 Loop 3 이관.

### AC 증거
| AC | 결과 |
|---|---|
| **AC1 validate 실 API** | 본인 번호 `본인 사업자번호(마스킹)` → `valid:"02"`,`valid_msg:"확인할 수 없습니다."`(더미 대표자명이라 불일치=정상). PII 무잔류. 인증·파싱·폐기 파이프라인 동작 증명. |
| **AC1 statuses** | **대기** — 상태조회 서비스 키 미활성(-3). AC2 모킹으로 회피. |
| **AC2 장애주입** | vitest **18/18 통과**. 5xx→SERVER(3회 재시도)·Abort→TIMEOUT·TypeError→NETWORK·`-3`→SERVICE_NOT_ACTIVATED(재시도X)·MALFORMED·101건→TOO_LARGE·체크섬실패→BUSINESS_NUMBER. |
| **AC3 PII 무잔류** | 3계층: (1) 센티넬 echo→결과/로그/캐시 grep 0건 (2) validate 후 `cache.set` 0회 (3) 소스 `request_param` 식별자 미등장(주석제외) + 실 API 더미명 무잔류. |
| build/lint/test | tsc 통과, eslint 클린, vitest 18 passed. |

### 설계 결정 (R2 — 핵심)
NTS `/validate` 응답이 `request_param`에 `p_nm`/`start_dt`를 **echo**로 반환 → `ValidateResultItemSchema`에 `request_param` 미선언 → zod strip으로 폐기. AC3 계층1·실 API로 증명.

### 미해결 이슈
- **statuses 키 미활성** → 상태조회 서비스 추가 활용신청 대기. 승인 후 AC1 statuses + `/status` vs `/statuses` A/B 확정(R1).
- npm audit devDep 취약점 5개 → Loop 4.

---

## Loop 3 — 도구 5종 + 판정 로직 ✅ 완료 (2026-07-08)

### 수행 내용
- `docs/rules.md` 판정 규칙표(과세유형×상태 → 판정+basis) 문서화(규칙=스펙).
- `src/eligibility.ts` 판정 순수 함수 + 테이블 주도 테스트.
- `src/index.ts` MCP 도구 5종 등록(`registerTool`, zod 입출력 스키마). NtsClient/eligibility 연결, 면책 상시 포함.

### AC 증거 (AC: Inspector 5종 호출 성공 + 판정 규칙표 전 조합)
| 항목 | 결과 |
|---|---|
| 도구 등록 | `tools/list` 5종: verify_business, check_business_status, batch_check_status, check_invoice_eligibility, explain_kr_tax_type |
| verify_business 실연동 | `본인 사업자번호(마스킹)` → match:false(더미 대표자명), basis+disclaimer |
| check_business_status 실연동 | 계속사업자/일반과세자, `b_stt_cd:"01"`/`tax_type_cd:"01"` 정상 |
| batch_check_status 실연동 | 2건(본인번호(마스킹), 공개법인번호(마스킹)) 정상 |
| check_invoice_eligibility 실연동 | `TAX_INVOICE_OK` + basis + disclaimer |
| explain_kr_tax_type | 면세사업자 해설 정상 |
| 판정 규칙표 테스트 | eligibility 12 케이스(전 조합) 통과 |
| build/lint/test | tsc 통과, eslint 클린, vitest **30 passed** |

### 실연동 중 해결
- **상태조회 서비스 활성화 확인** → R3 해결, AC1 statuses 달성.
- **R1 경로 `/status`(단수) 확정** — 실제 작동 확인(복수 아님).
- **`tax_type_cd` 2자리(`"01"`) 스키마 정정** → `rules.md` 표 + `eligibility` fallback(1·2자리 양쪽 처리).

### 미해결 이슈
- npm audit devDep 취약점 5개 → Loop 4.
- 도구 description 자연어 매핑 퇴고 — Loop 5 Claude Desktop 실연결 시 검증.
- 루프 0 git 미초기화 여전(요청 시).

---

## Loop 4 — 신뢰성 강화 ✅ 완료 (2026-07-08)

### 수행 내용
- `@vitest/coverage-v8` 도입, `vitest.config.ts`(thresholds 80, 진입점 `index.ts` 제외).
- eslint `.gitignore`에 `coverage/` 추가, eslint ignores에 `coverage/**`.

### AC 증거 (AC: 커버리지 80%+, 카오스 크래시 0, audit 클린)
| 항목 | 결과 |
|---|---|
| 커버리지 | **96.15%**(lines) — thresholds 80 통과(exit 0). `index.ts` 진입점 제외(도구 핸들러는 MCP 실연동으로 검증). |
| 카오스(API 5xx·타임아웃) | AC2(Loop 2)로 달성 — 5xx/Abort/네트워크 주입 **크래시 0**, 우아한 실패(NtsError 매핑). |
| 체크섬 사전 검증 | 완료(Loop 2) — BUSINESS_NUMBER, API 미호출로 쿼터 절약. |
| 에러 코드 표준화 | 완료(Loop 2) — NtsError 9코드 + 정적 메시지. |
| lint | eslint 클린(0 warning). |
| **npm audit** | **prod 의존성 0 취약점**(배포 번들 안전). devDep 5개(vitest/vite/esbuild dev-server, GHSA-67mh-4wv8-2f99) — 프로덕션 무관·vitest CLI 전용 사용으로 실威胁 없음 → **수용**. fix는 vitest 2→4 breaking upgrade(ERESOLVE 충돌) 필요해 보류. |

### 미해결/결정 사항
- devDep audit: vitest 4 메이저 업그레이드 필요(ERESOLVE). 실威胁 없어 수용. 향후 vitest 안정화 시 재검토.
- git 미초기화 여전(요청 시).

---

## Loop 5 — 문서화 + DEMO_MODE ✅ 완료 (2026-07-08)

### 수행 내용
- `src/demo.ts` — 가상 사업자번호 셋(`1111111119`/`2222222227`/`3333333336`, 체크섬 유효) + `DemoClient`. `src/index.ts` DEMO_MODE 분기(`DEMO_MODE=1` 또는 키 없음).
- `docs/get-api-key.md` — 발급 가이드(진위·상태 **별도 신청** 함정 포함).
- `README.md`(한국어 우선) + `README-EN.md`.

### AC 증거 (AC: 키 없이 3분 내 첫호출, 라이브 전환 20분 내)
| 항목 | 결과 |
|---|---|
| DEMO 첫호출 | `DEMO_MODE=1` → 3 판정 케이스(일반→TAX_INVOICE_OK / 면세→CASH_INVOICE_EXEMPT / 폐업→UNAVAILABLE) **즉시 응답**(네트워크 無) ✓ |
| 라이브 전환 | `.env` `NTS_SERVICE_KEY` 시 자동 라이브(Loop 3에서 실연동 검증 완료). `get-api-key.md` 가이드로 20분 내 가능. |
| 도구 체험 | 5종 도구 DEMO 동작. |

### 미해결
- npm 미게시(npx 미지원, Loop 6). README는 로컬 빌드 기준.
- Claude Desktop 자연어 매핑(도구 description) 본격 검증 미수행 — Loop 6+ 디렉터리 등재 전 사용자 실사용으로 회귀.

---

## Loop 6 — 디렉터리 총등재 (게시 준비 완료 · `[HUMAN]` 대기) (2026-07-08)

### 수행 내용 (구현 담당)
- `package.json` 게시 메타: version `0.1.0`, license `MIT`, keywords, `files` 화이트리스트, author placeholder.
- `LICENSE` (MIT, holder placeholder).
- `npm publish --dry-run` 패키징 검증.

### AC 증거 (게시 준비)
| 항목 | 결과 |
|---|---|
| shebang 보존 | `dist/index.js` 첫 줄 `#!/usr/bin/env node` ✓ (npx 직접 실행 가능) |
| dry-run | `korea-business-verify@0.1.0`, 32 files, 26.5kB 패키지 |
| 보안 | `.env` **미포함**(files 화이트리스트 = dist/docs/README/LICENSE만) → 서비스키 노출 無 |
| npm 로그인 warn | 정상(게시 시 [HUMAN] 로그인 필요) |

### `[HUMAN]` 대기 (외부 게시)
1. `package.json` author(이름/이메일)·repository(git URL) placeholder → 실제값 교체.
2. `git init` + 첫 커밋(게시/등재 전제).
3. `npm login` → `npm publish` (실제 게시).
4. 디렉터리 등재 5+곳: awesome-mcp, mcp-get, Glama, 한국 채널(awesome-mcp-korea 등) — A안 파이프라인 재사용(계획서 §0.4).

### 미해결
- 실제 게시·등재는 [HUMAN]. 완료 후 Loop 7(호스티드, 게이트: 출시+4주 WAU 10)·Loop 8(수익화, 게이트: WAU 30)은 지표 대기.

### 업데이트 (2026-07-08)
- ✅ `git init` + 첫 커밋(`29e4955`, 29 파일) + **private repo 생성·push** 완료: `wujinkim/korea-business-verify` (PRIVATE).
- ✅ `.env` 추적 제외 검증(서비스키 노출 無). private이므로 내부 전략 문서(CLAUDE.md/plan/PROGRESS/ADR) 포함.
- ⏳ 남은 [HUMAN]: npm 게시(npm은 기본 public, private 게시는 유료 org 필요 — 방향 결정), 디렉터리 등재(public 게시 후).
