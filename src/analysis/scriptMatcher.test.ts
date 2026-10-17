import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildDiffSegments,
  calculateEditDistance,
  calculateMatchRate,
  compareWithScript,
  convertToHiragana,
  initTokenizer,
  normalizeText,
} from './scriptMatcher';

// 要件定義書 10.2 のテスト。実装したら it.todo を it に書き換える

beforeAll(async () => {
  await initTokenizer();
});

describe('normalizeText / convertToHiragana (T-03)', () => {
  it('句読点・空白・改行・記号が除かれ、漢字・カタカナ・数字がひらがなに変換される', () => {
    expect(normalizeText('こんにちは、世界。')).toBe('こんにちはせかい');
    expect(normalizeText('こんにちは 世界\n')).toBe('こんにちはせかい');
    expect(normalizeText('こんにちは　世界!?「」・…')).toBe('こんにちはせかい');
    expect(normalizeText('拙者親方と申すは')).toBe('せっしゃおやかたともうすは');
    expect(normalizeText('スピーチ練習')).toBe('すぴーちれんしゅう');
    expect(normalizeText('20り')).toBe('にじゅうり');
    expect(convertToHiragana('拙者、親方と申すは。')).toBe('せっしゃ、おやかたともうすは。');
  });
});

describe('calculateMatchRate', () => {
  it('T-04: 台本と同じ文 → 100。句読点だけ違う文 → 100。漢字とひらがなの表記ゆれも 100', () => {
    expect(calculateMatchRate('こんにちは', 'こんにちは')).toBe(100);
    expect(calculateMatchRate('こんにちは、世界。', 'こんにちは　せかい！')).toBe(100);
    expect(calculateMatchRate('拙者親方と申すは', 'せっしゃおやかたともうすは')).toBe(100);
  });

  it('T-05: 台本「こんにちは」と文字起こし「こんちは」 → 74', () => {
    expect(calculateMatchRate('こんにちは', 'こんちは')).toBe(74);
  });

  it('T-06: 文字起こしが空 → 0。台本よりずっと長い文字起こしでも 0 を下回らない', () => {
    expect(calculateMatchRate('こんにちは', '')).toBe(0);
    expect(calculateMatchRate('あ', 'かきくけこさしすせそたちつてと')).toBe(0);
  });

  it('かな属性テーブルに基づく類似音スコアと外郎売テストデータを正しく計算する', () => {
    // 清濁の差(か vs が: +8 → 8/10 = 80%)
    expect(calculateMatchRate('か', 'が')).toBe(80);
    // 類似子音かつ同母音(さ vs た: +6 → 6/10 = 60%)
    expect(calculateMatchRate('さ', 'た')).toBe(60);
    // 同子音・異母音(か vs き: +4 → 4/10 = 40%)
    expect(calculateMatchRate('か', 'き')).toBe(40);
    // 同母音・異子音(あ vs か: +2 → 2/10 = 20%)
    expect(calculateMatchRate('あ', 'か')).toBe(20);

    const referenceRaw =
      '拙者親方と申すは、お立合いの中に御存知のお方もござりましょうが、お江戸を発って二十里上方、相州小田原一色町をお過ぎなされて、青物町を登りへおいでなさるれば、欄干橋虎屋藤右衛門、只今は剃髪致して円斎と名乗りまする。';
    const hypothesisRaw =
      'せっしゃおやかたともーすおたちあいのうちにごぞんじのほーもござりましょーがおえどおたって20りかみがたふたごおだわらいっしょくちょーおおすぎなされてあおのまちのぼるよりでなされればらんかんはしとらやふじえもんのただいまてーはついたしてまどかあやとなのりまする';
    const rate = calculateMatchRate(referenceRaw, hypothesisRaw);
    expect(rate).toBeGreaterThanOrEqual(65);
    expect(rate).toBeLessThanOrEqual(100);
  });
});

describe('calculateEditDistance / buildDiffSegments / compareWithScript', () => {
  it('編集距離を正しく返す', () => {
    expect(calculateEditDistance('こんにちは', 'こんちは')).toBe(1);
    expect(calculateEditDistance('こんにちは', 'こんにちは')).toBe(0);
  });

  it('台本との違いを区分分けして返す', () => {
    expect(buildDiffSegments('こんにちは', 'こんちは')).toEqual([
      { type: 'match', text: 'こん' },
      { type: 'missing', text: 'に' },
      { type: 'match', text: 'ちは' },
    ]);

    const result = compareWithScript('拙者', 'せっしゃ');
    expect(result.matchRate).toBe(100);
    expect(result.segments).toEqual([{ type: 'match', text: 'せっしゃ' }]);
  });
});
