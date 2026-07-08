import { defineConfig } from 'vitest/config';

// 진입점 src/index.ts(McpServer 등록 + stdio 부작용)는 커버리지 제외.
// 도구 핸들러 로직은 NtsClient(src/nts)·eligibility 로 위임되어 단위 테스트 대상.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
