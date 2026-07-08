import type { StatusResultItem } from './types.js';

// 상태조회 전용 24h TTL 캐시. 진위확인(validate)은 이 모듈을 사용하지 않는다(도메인 원칙).
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  value: StatusResultItem;
  expiresAt: number;
}

export class StatusCache {
  private readonly store = new Map<string, Entry>();

  get(bno: string): StatusResultItem | undefined {
    const entry = this.store.get(bno);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(bno);
      return undefined;
    }
    return entry.value;
  }

  set(bno: string, value: StatusResultItem): void {
    this.store.set(bno, { value, expiresAt: Date.now() + STATUS_TTL_MS });
  }

  size(): number {
    return this.store.size;
  }

  /** 테스트/진단용 dump(만료 제외). 상태결과엔 PII 없음. */
  values(): StatusResultItem[] {
    const now = Date.now();
    return [...this.store.values()].filter((e) => now < e.expiresAt).map((e) => e.value);
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}
