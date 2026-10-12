import { describe, it } from 'vitest';

// 要件定義書 10.2 のテスト。実装したら it.todo を it に書き換える

describe('normalizeText (T-03)', () => {
  it.todo('句読点・空白・改行・記号が除かれる');
});

describe('calculateMatchRate', () => {
  it.todo('T-04: 台本と同じ文 → 100。句読点だけ違う文 → 100');
  it.todo('T-05: 台本「こんにちは」と文字起こし「こんちは」 → 80');
  it.todo('T-06: 文字起こしが空 → 0。台本よりずっと長い文字起こしでも 0 を下回らない');
});
