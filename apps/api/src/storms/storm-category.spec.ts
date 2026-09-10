import { describe, it, expect } from 'vitest';
import { categoryFromWindKt } from './storm-category.js';

describe('categoryFromWindKt', () => {
  it('returns null for null wind speed', () => {
    expect(categoryFromWindKt(null)).toBeNull();
  });

  it('returns null for winds below tropical-storm threshold (<34 kt)', () => {
    expect(categoryFromWindKt(0)).toBeNull();
    expect(categoryFromWindKt(10)).toBeNull();
    expect(categoryFromWindKt(33)).toBeNull();
  });

  it('classifies tropical storms (34-63 kt) as category 0', () => {
    expect(categoryFromWindKt(34)).toBe(0);
    expect(categoryFromWindKt(50)).toBe(0);
    expect(categoryFromWindKt(63)).toBe(0);
  });

  it('matches Saffir-Simpson boundaries exactly', () => {
    // Category 1: 64-82 kt
    expect(categoryFromWindKt(64)).toBe(1);
    expect(categoryFromWindKt(82)).toBe(1);
    // Category 2: 83-95 kt
    expect(categoryFromWindKt(83)).toBe(2);
    expect(categoryFromWindKt(95)).toBe(2);
    // Category 3: 96-112 kt
    expect(categoryFromWindKt(96)).toBe(3);
    expect(categoryFromWindKt(112)).toBe(3);
    // Category 4: 113-136 kt
    expect(categoryFromWindKt(113)).toBe(4);
    expect(categoryFromWindKt(136)).toBe(4);
    // Category 5: 137+ kt
    expect(categoryFromWindKt(137)).toBe(5);
    expect(categoryFromWindKt(150)).toBe(5);
    expect(categoryFromWindKt(200)).toBe(5);
  });

  it('is monotonic (never decreases as wind increases)', () => {
    const samples = [30, 40, 50, 63, 70, 84, 100, 120, 145];
    for (let i = 1; i < samples.length; i++) {
      const prev = categoryFromWindKt(samples[i - 1]) ?? -1;
      const cur = categoryFromWindKt(samples[i]) ?? -1;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
});