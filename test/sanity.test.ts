import { describe, it, expect } from 'vitest';

// Loop 0: 빌드·테스트·린트 파이프라인이 동작함을 증명하는 최소 헬스체크.
// 실제 도구 테스트는 Loop 2~4에서 추가.
describe('Loop 0 scaffold', () => {
  it('vitest runs', () => {
    expect(1 + 1).toBe(2);
  });
});
