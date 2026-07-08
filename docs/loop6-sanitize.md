# Loop 6 — Clean Restart (2nd) Evidence

**날짜:** 2026-07-08
**저장소:** `wujinkim/korea-business-verify` (PRIVATE)

## 배경
- 1차 재시작본의 본 evidence 문서에 **실제 사업자번호·서비스키 조각이 평문(grep 명령 인자)으로 포함**돼 GitHub 저장소를 HUMAN이 삭제.
- 원본은 로컬 작업 디렉터리. 로컬 기존 `.git`은 절대 재사용하지 않고 새로 init.
- **HUMAN 결정: 서비스키 재발급 생략** — 결정자 HUMAN(2026-07-08). 근거: 구 저장소는 private-only 존재 + 공공데이터 서비스키는 저등급·무료 재발급 가능 키.

## 절대 규칙 (본 문서 포함 모든 파일)
실제 사업자번호·서비스키·대표자명을 **어떤 형태로도 기재하지 않는다**.
- 사업자번호 실값 → `<본인 사업자번호(마스킹)>`
- 서비스키 조각 → `<서비스키 앞 8자(마스킹)>`
- grep 명령은 **값이 아닌 패턴 설명**으로 기록.

---

## A. 정화 상태 (1차 로컬 반영분 — 이번 검증 대상, 재수행 아님)
- `.gitignore`: `.env`, `.env.*`, `*.db`, `*.log`, `coverage/`, `dist/`, `node_modules/`
- `test/nts/*.test.ts`: 본인 사업자번호 → 환경변수 `TEST_BUSINESS_NO`/`TEST_BUSINESS_NO_2` + 가상 fallback(`1111111119` 등); 대표자명 → `TEST_REP_NAME`
- `LICENSE`(MIT), `package.json` `license: "MIT"`
- `package.json` `files` 화이트리스트(이번 `README-EN.md` 추가): `["dist","README.md","README-EN.md","LICENSE"]`
- `README.md`/`README-EN.md`: 무저장 원칙 섹션

---

## B. 검증

### B-3 grep (저장소 전체 — `docs/loop6-sanitize.md` 자신 포함)
**패턴 설명(값 아님):** 본인 사업자번호의 2가지 표기(① 10자리 연속 ② `NNN-NN-NNNNN` 하이픈 포맷) + 서비스키 앞 8자 + 실제 대표자명 후보를 OR 검색.
- 결과: **0건** — 본인 사업자번호 2표기·서비스키 앞 8자 모두 매치 없음(실제 대표자명은 애초에 미사용·더미만).

### B-4 `.gitignore` / `LICENSE`
- `.gitignore`: `node_modules/` `dist/` `coverage/` `.env` `.env.*` `*.db` `*.log`
- `LICENSE` MIT + `package.json` `license: "MIT"`: ✓ 확인

### B-5 `files`
`["dist","README.md","README-EN.md","LICENSE"]` — `README-EN.md` 추가가 이번 변경점.

### B-6 `npm pack --dry-run`
- 28 files / 18.0 kB. 포함: `dist/**`, `README.md`, `README-EN.md`, `LICENSE`, `package.json`.
- 제외 확인: `.env`, `src/`, `test/`, `docs/` ✓

### B-7 `npm test` / `npm run lint`
- `npm test`: **29 passed**. `npm run lint`: 클린(0 error/warning).

---

## C. 클린 저장소 (2차)

### C-8 3중 확인 (커밋 직전, 실제 명령·출력)
- (a) `git ls-files | grep -E '\.env$|\.db$|\.log$'` → **출력 없음** ✓
- (b) B-3 grep 재실행 → **0건** ✓
- (c) `git log --oneline | wc -l` → **1** (초기 커밋, push 시점)

### C-9 repo
- `gh repo create korea-business-verify --private --source=. --push`
- 결과: `wujinkim/korea-business-verify`(PRIVATE) — https://github.com/wujinkim/korea-business-verify. 단일 커밋 push 완료.

---

## 결론
클린 재등록 완료. 본 문서를 포함한 모든 파일에서 실제 사업자번호·서비스키·대표자명 **0건**. **public 전환 / npm publish / 디렉터리 제출은 HUMAN 결정 대기**(금지 사항 준수).
