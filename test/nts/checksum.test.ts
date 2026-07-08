import { describe, expect, it } from 'vitest';
import { isValidBusinessNo, normalizeBusinessNo } from '../../src/nts/checksum';

// 테스트용 사업자번호/대표자명은 환경변수로 주입 가능(기본값은 체크설 유효한 가상 번호).
const TEST_BNO = process.env.TEST_BUSINESS_NO ?? '1111111119';

describe('checksum', () => {
  it('가상 사업자번호 체크섬 유효', () => {
    expect(isValidBusinessNo(TEST_BNO)).toBe(true);
    expect(isValidBusinessNo('1111111119')).toBe(true);
  });
  it('잘못된 번호 무효', () => {
    expect(isValidBusinessNo('1234567890')).toBe(false);
    expect(isValidBusinessNo('1111111118')).toBe(false); // 체크디지트 1 감소
    expect(isValidBusinessNo('111111111')).toBe(false); // 9자리
    expect(isValidBusinessNo('abcdefghij')).toBe(false);
  });
  it('정규화', () => {
    expect(normalizeBusinessNo('111-11-11119')).toBe('1111111119');
  });
});
