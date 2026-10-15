import { describe, expect, it } from 'vitest';
import { calculateCpm, countCharacters } from './speedCalculator';

// 要件定義書 10.2 のテスト。実装したら it.todo を it に書き換える

describe('countCharacters (T-03)', () => {
  it('句読点・空白・改行・記号が除かれる', () => {
    expect(countCharacters('こんにちは、世界。')).toBe(7);
    expect(countCharacters('こんにちは 世界\n')).toBe(7);
    expect(countCharacters('こんにちは　世界!?「」・…')).toBe(7);
    expect(countCharacters('Hello, World!')).toBe(10);
  });

  it('長音符や「々」は文字として数える', () => {
    expect(countCharacters('ラーメン')).toBe(4);
    expect(countCharacters('時々')).toBe(2);
  });

  it('半角カナや分かれた濁点は1文字にまとめて数える', () => {
    expect(countCharacters('ｶﾞｷﾞ')).toBe(2);
    expect(countCharacters('か\u3099')).toBe(1); // 「か」+ 濁点
  });

  it('空文字や記号だけの文は0', () => {
    expect(countCharacters('')).toBe(0);
    expect(countCharacters('、。 \n!?')).toBe(0);
  });
});

describe('calculateCpm', () => {
  it('4.1の式(文字数 ÷ 秒数 × 60)で計算する', () => {
    expect(calculateCpm(50, 10)).toBe(300);
    expect(calculateCpm(0, 10)).toBe(0);
  });

  it('経過時間が0以下なら0', () => {
    expect(calculateCpm(10, 0)).toBe(0);
    expect(calculateCpm(10, -1)).toBe(0);
  });

  it('数値でない値が来たら0', () => {
    expect(calculateCpm(10, Number.NaN)).toBe(0);
    expect(calculateCpm(Number.NaN, 10)).toBe(0);
    expect(calculateCpm(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
