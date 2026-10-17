import { describe, expect, it } from 'vitest';
import { getAudienceSpriteKey, judgeSpeed } from './judge';

// 要件定義書 10.2 のテスト。実装したら it.todo を it に書き換える

describe('judgeSpeed (T-01)', () => {
  it('249 → slow、250 → optimal、350 → optimal、351 → fast', () => {
    expect(judgeSpeed(249)).toBe('slow');
    expect(judgeSpeed(250)).toBe('optimal');
    expect(judgeSpeed(350)).toBe('optimal');
    expect(judgeSpeed(351)).toBe('fast');
  });

  it('境界のすぐ外の小数も正しく判定する', () => {
    expect(judgeSpeed(249.9)).toBe('slow');
    expect(judgeSpeed(350.1)).toBe('fast');
  });
});

describe('getAudienceSpriteKey (T-02)', () => {
  it('3通りすべてで 4.3 の表と同じキーが返る', () => {
    expect(getAudienceSpriteKey('slow')).toBe('audience_slow');
    expect(getAudienceSpriteKey('optimal')).toBe('audience_optimal');
    expect(getAudienceSpriteKey('fast')).toBe('audience_fast');
  });
});
