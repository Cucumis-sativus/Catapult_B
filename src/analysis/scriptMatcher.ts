import kuromoji, { type IpadicFeatures, type Tokenizer } from 'kuromoji';
import type { DiffSegment, DiffType, MatchResult } from '../types';

// 一致度の計算(F-06、要件定義書 4.2)

/** 除きたい文字(句読点・記号・空白・改行・制御文字)。長音符「ー」や「々」は残す */
const NON_COMPARED_CHAR_PATTERN = /[\p{P}\p{S}\p{Z}\p{Cf}\s]/gu;

/** ギャップのペナルティ */
const GAP_PENALTY = 3;

/** 2文字間のスコア定数 */
const SCORE_EXACT_MATCH = 10;
const SCORE_BASE_VOWEL_MATCH = 8;
const SCORE_SIMILAR_CONSONANT_VOWEL_MATCH = 6;
const SCORE_CONSONANT_MATCH = 4;
const SCORE_VOWEL_MATCH = 2;
const SCORE_MISMATCH = -3;

/** トレースバックの方向 */
const DIR_DIAG = 0;
const DIR_UP = 1;
const DIR_LEFT = 2;

/** カタカナからひらがなへのコードポイント差分 */
const KATAKANA_TO_HIRAGANA_OFFSET = 0x60;

/** 初期化済みの kuromoji トークナイザ */
let cachedTokenizer: Tokenizer<IpadicFeatures> | null = null;

/** 初期化中の Promise */
let tokenizerPromise: Promise<void> | null = null;

/** 実行環境に応じた kuromoji 辞書パスを返す */
function getDictionaryPath(): string {
  if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
    return '/dict/';
  }
  return 'public/dict/';
}

/** kuromoji の辞書を読み込んでトークナイザを初期化する */
export function initTokenizer(): Promise<void> {
  if (cachedTokenizer !== null) {
    return Promise.resolve();
  }
  if (tokenizerPromise !== null) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise<void>((resolve) => {
    try {
      kuromoji.builder({ dicPath: getDictionaryPath() }).build((err, tokenizer) => {
        if (!err && tokenizer) {
          cachedTokenizer = tokenizer;
        }
        resolve();
      });
    } catch {
      resolve();
    }
  });

  return tokenizerPromise;
}

// ブラウザ起動時にバックグラウンドで辞書を先読みしておく
if (typeof window !== 'undefined' && typeof XMLHttpRequest !== 'undefined') {
  void initTokenizer();
}

/** カタカナをひらがなに変換する */
function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCodePoint((char.codePointAt(0) ?? 0) - KATAKANA_TO_HIRAGANA_OFFSET),
  );
}

/** 1〜9999 の整数を漢数字に変換する(kuromoji が助数詞と合わせて正しく読めるようにする) */
function convertFourDigitChunkToKanji(num: number): string {
  const kanjiDigits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const thousands = Math.floor(num / 1000);
  const hundreds = Math.floor((num % 1000) / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  const thousandsText =
    thousands === 0 ? '' : thousands === 1 ? '千' : `${kanjiDigits[thousands] ?? ''}千`;
  const hundredsText =
    hundreds === 0 ? '' : hundreds === 1 ? '百' : `${kanjiDigits[hundreds] ?? ''}百`;
  const tensText = tens === 0 ? '' : tens === 1 ? '十' : `${kanjiDigits[tens] ?? ''}十`;
  const onesText = kanjiDigits[ones] ?? '';

  return thousandsText + hundredsText + tensText + onesText;
}

/** 半角数字の並びを漢数字に変換する(例: "20" → "二十") */
function convertDigitsToKanji(text: string): string {
  const kanjiDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  return text.replace(/\d+/g, (digits) => {
    const value = Number.parseInt(digits, 10);
    if (!Number.isSafeInteger(value) || value < 0 || digits.length > 8) {
      return Array.from(digits)
        .map((d) => kanjiDigits[Number.parseInt(d, 10)] ?? d)
        .join('');
    }
    if (value === 0) {
      return '零';
    }
    const manPart = Math.floor(value / 10000);
    const restPart = value % 10000;
    const manText = manPart > 0 ? `${convertFourDigitChunkToKanji(manPart)}万` : '';
    const restText = restPart > 0 ? convertFourDigitChunkToKanji(restPart) : '';
    return manText + restText;
  });
}

/** 1〜9999 の整数をひらがな読みに変換する(辞書未読み込み時のフォールバック用) */
function convertFourDigitChunkToHiragana(num: number): string {
  const onesReading = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
  const tensReading = [
    '',
    'じゅう',
    'にじゅう',
    'さんじゅう',
    'よんじゅう',
    'ごじゅう',
    'ろくじゅう',
    'ななじゅう',
    'はちじゅう',
    'きゅうじゅう',
  ];
  const hundredsReading = [
    '',
    'ひゃく',
    'にひゃく',
    'さんびゃく',
    'よんひゃく',
    'ごひゃく',
    'ろっぴゃく',
    'ななひゃく',
    'はっぴゃく',
    'きゅうひゃく',
  ];
  const thousandsReading = [
    '',
    'せん',
    'にせん',
    'さんぜん',
    'よんせん',
    'ごせん',
    'ろくせん',
    'ななせん',
    'はっせん',
    'きゅうせん',
  ];

  const thousands = Math.floor(num / 1000);
  const hundreds = Math.floor((num % 1000) / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;

  return (
    (thousandsReading[thousands] ?? '') +
    (hundredsReading[hundreds] ?? '') +
    (tensReading[tens] ?? '') +
    (onesReading[ones] ?? '')
  );
}

/** 半角数字の並びを日本語のひらがな読みに変換する(例: "20" → "にじゅう") */
function convertDigitsToHiragana(text: string): string {
  const digitReading = [
    'ぜろ',
    'いち',
    'に',
    'さん',
    'よん',
    'ご',
    'ろく',
    'なな',
    'はち',
    'きゅう',
  ];

  return text.replace(/\d+/g, (digits) => {
    const value = Number.parseInt(digits, 10);
    if (!Number.isSafeInteger(value) || value < 0 || digits.length > 8) {
      return Array.from(digits)
        .map((d) => digitReading[Number.parseInt(d, 10)] ?? d)
        .join('');
    }
    if (value === 0) {
      return 'ぜろ';
    }
    const manPart = Math.floor(value / 10000);
    const restPart = value % 10000;
    const manReading = manPart > 0 ? `${convertFourDigitChunkToHiragana(manPart)}まん` : '';
    const restReading = restPart > 0 ? convertFourDigitChunkToHiragana(restPart) : '';
    return manReading + restReading;
  });
}

/** kuromoji を用いて文字列をひらがなに変換する */
export function convertToHiragana(text: string): string {
  const normalized = text.normalize('NFKC');
  if (cachedTokenizer === null) {
    return katakanaToHiragana(convertDigitsToHiragana(normalized));
  }

  const tokens = cachedTokenizer.tokenize(convertDigitsToKanji(normalized));
  let result = '';
  for (const token of tokens) {
    if (token.reading !== undefined && token.reading !== '*') {
      result += katakanaToHiragana(token.reading);
    } else {
      result += katakanaToHiragana(convertDigitsToHiragana(token.surface_form));
    }
  }
  return result;
}

/** ひらがなの属性を定義する構造体 */
interface KanaDef {
  readonly ch: string;
  readonly base: string;
  readonly cons: string;
  readonly vow: string;
}

/** ひらがな属性テーブル */
const KANA_TABLE: readonly KanaDef[] = [
  { ch: 'あ', base: 'あ', cons: ' ', vow: 'a' },
  { ch: 'い', base: 'い', cons: ' ', vow: 'i' },
  { ch: 'う', base: 'う', cons: ' ', vow: 'u' },
  { ch: 'え', base: 'え', cons: ' ', vow: 'e' },
  { ch: 'お', base: 'お', cons: ' ', vow: 'o' },
  { ch: 'か', base: 'か', cons: 'k', vow: 'a' },
  { ch: 'き', base: 'き', cons: 'k', vow: 'i' },
  { ch: 'く', base: 'く', cons: 'k', vow: 'u' },
  { ch: 'け', base: 'け', cons: 'k', vow: 'e' },
  { ch: 'こ', base: 'こ', cons: 'k', vow: 'o' },
  { ch: 'が', base: 'か', cons: 'k', vow: 'a' },
  { ch: 'ぎ', base: 'き', cons: 'k', vow: 'i' },
  { ch: 'ぐ', base: 'く', cons: 'k', vow: 'u' },
  { ch: 'げ', base: 'け', cons: 'k', vow: 'e' },
  { ch: 'ご', base: 'こ', cons: 'k', vow: 'o' },
  { ch: 'さ', base: 'さ', cons: 's', vow: 'a' },
  { ch: 'し', base: 'し', cons: 's', vow: 'i' },
  { ch: 'す', base: 'す', cons: 's', vow: 'u' },
  { ch: 'せ', base: 'せ', cons: 's', vow: 'e' },
  { ch: 'そ', base: 'そ', cons: 's', vow: 'o' },
  { ch: 'ざ', base: 'さ', cons: 's', vow: 'a' },
  { ch: 'じ', base: 'し', cons: 's', vow: 'i' },
  { ch: 'ず', base: 'す', cons: 's', vow: 'u' },
  { ch: 'ぜ', base: 'せ', cons: 's', vow: 'e' },
  { ch: 'ぞ', base: 'そ', cons: 's', vow: 'o' },
  { ch: 'た', base: 'た', cons: 't', vow: 'a' },
  { ch: 'ち', base: 'ち', cons: 't', vow: 'i' },
  { ch: 'つ', base: 'つ', cons: 't', vow: 'u' },
  { ch: 'て', base: 'て', cons: 't', vow: 'e' },
  { ch: 'と', base: 'と', cons: 't', vow: 'o' },
  { ch: 'だ', base: 'た', cons: 't', vow: 'a' },
  { ch: 'ぢ', base: 'ち', cons: 't', vow: 'i' },
  { ch: 'づ', base: 'つ', cons: 't', vow: 'u' },
  { ch: 'で', base: 'て', cons: 't', vow: 'e' },
  { ch: 'ど', base: 'と', cons: 't', vow: 'o' },
  { ch: 'な', base: 'な', cons: 'n', vow: 'a' },
  { ch: 'に', base: 'に', cons: 'n', vow: 'i' },
  { ch: 'ぬ', base: 'ぬ', cons: 'n', vow: 'u' },
  { ch: 'ね', base: 'ね', cons: 'n', vow: 'e' },
  { ch: 'の', base: 'の', cons: 'n', vow: 'o' },
  { ch: 'は', base: 'は', cons: 'h', vow: 'a' },
  { ch: 'ひ', base: 'ひ', cons: 'h', vow: 'i' },
  { ch: 'ふ', base: 'ふ', cons: 'h', vow: 'u' },
  { ch: 'へ', base: 'へ', cons: 'h', vow: 'e' },
  { ch: 'ほ', base: 'ほ', cons: 'h', vow: 'o' },
  { ch: 'ば', base: 'は', cons: 'h', vow: 'a' },
  { ch: 'び', base: 'ひ', cons: 'h', vow: 'i' },
  { ch: 'ぶ', base: 'ふ', cons: 'h', vow: 'u' },
  { ch: 'べ', base: 'へ', cons: 'h', vow: 'e' },
  { ch: 'ぼ', base: 'ほ', cons: 'h', vow: 'o' },
  { ch: 'ぱ', base: 'は', cons: 'h', vow: 'a' },
  { ch: 'ぴ', base: 'ひ', cons: 'h', vow: 'i' },
  { ch: 'ぷ', base: 'ふ', cons: 'h', vow: 'u' },
  { ch: 'ぺ', base: 'へ', cons: 'h', vow: 'e' },
  { ch: 'ぽ', base: 'ほ', cons: 'h', vow: 'o' },
  { ch: 'ま', base: 'ま', cons: 'm', vow: 'a' },
  { ch: 'み', base: 'み', cons: 'm', vow: 'i' },
  { ch: 'む', base: 'む', cons: 'm', vow: 'u' },
  { ch: 'め', base: 'め', cons: 'm', vow: 'e' },
  { ch: 'も', base: 'も', cons: 'm', vow: 'o' },
  { ch: 'や', base: 'や', cons: 'y', vow: 'a' },
  { ch: 'ゆ', base: 'ゆ', cons: 'y', vow: 'u' },
  { ch: 'よ', base: 'よ', cons: 'y', vow: 'o' },
  { ch: 'ら', base: 'ら', cons: 'r', vow: 'a' },
  { ch: 'り', base: 'り', cons: 'r', vow: 'i' },
  { ch: 'る', base: 'る', cons: 'r', vow: 'u' },
  { ch: 'れ', base: 'れ', cons: 'r', vow: 'e' },
  { ch: 'ろ', base: 'ろ', cons: 'r', vow: 'o' },
  { ch: 'わ', base: 'わ', cons: 'w', vow: 'a' },
  { ch: 'を', base: 'を', cons: 'w', vow: 'o' },
  { ch: 'ん', base: 'ん', cons: 'N', vow: ' ' },
];

/** ひらがなの属性を取得する関数 */
function getKanaDef(c: string): KanaDef | null {
  for (let i = 0; i < KANA_TABLE.length; i++) {
    const def = KANA_TABLE[i];
    if (def !== undefined && def.ch === c) {
      return def;
    }
  }
  return null;
}

/** 2文字間のスコアを計算する関数 */
function getScore(c1: string, c2: string): number {
  if (c1 === c2) {
    return SCORE_EXACT_MATCH;
  }

  const d1 = getKanaDef(c1);
  const d2 = getKanaDef(c2);

  if (d1 === null || d2 === null) {
    return SCORE_MISMATCH;
  }

  if (d1.base === d2.base && d1.vow === d2.vow) {
    return SCORE_BASE_VOWEL_MATCH;
  }

  let isSimC = false;
  if (
    (d1.cons === 's' || d1.cons === 't' || d1.cons === 'r') &&
    (d2.cons === 's' || d2.cons === 't' || d2.cons === 'r')
  ) {
    isSimC = true;
  }
  if ((d1.cons === 'n' || d1.cons === 'm') && (d2.cons === 'n' || d2.cons === 'm')) {
    isSimC = true;
  }

  if (isSimC && d1.vow === d2.vow && d1.vow !== ' ') {
    return SCORE_SIMILAR_CONSONANT_VOWEL_MATCH;
  }
  if (d1.cons === d2.cons && d1.cons !== ' ') {
    return SCORE_CONSONANT_MATCH;
  }
  if (d1.vow === d2.vow && d1.vow !== ' ') {
    return SCORE_VOWEL_MATCH;
  }

  return SCORE_MISMATCH;
}

/** 3つの値の最大値と方向を返す関数 */
function max3(a: number, b: number, c: number): { maxVal: number; dir: number } {
  let maxVal = a;
  let dir = DIR_DIAG;
  if (b > maxVal) {
    maxVal = b;
    dir = DIR_UP;
  }
  if (c > maxVal) {
    maxVal = c;
    dir = DIR_LEFT;
  }
  return { maxVal, dir };
}

/** アラインメントの1ステップ分の文字ペア(ギャップは null) */
interface AlignedPair {
  readonly char1: string | null;
  readonly char2: string | null;
}

/** Needleman-Wunsch 法の計算結果 */
interface AlignmentResult {
  readonly actualScore: number;
  readonly maxScore: number;
  readonly percentage: number;
  readonly matchRate: number;
  readonly alignedPairs: AlignedPair[];
}

/** Needleman-Wunsch 法でアラインメントと100点満点スコアを計算する */
function needlemanWunsch(seq1: readonly string[], seq2: readonly string[]): AlignmentResult {
  const len1 = seq1.length;
  const len2 = seq2.length;
  const cols = len2 + 1;

  const fMatrix = new Int32Array((len1 + 1) * cols);
  const ptrMatrix = new Uint8Array((len1 + 1) * cols);

  fMatrix[0] = 0;
  for (let i = 1; i <= len1; i++) {
    fMatrix[i * cols] = -i * GAP_PENALTY;
    ptrMatrix[i * cols] = DIR_UP;
  }
  for (let j = 1; j <= len2; j++) {
    fMatrix[j] = -j * GAP_PENALTY;
    ptrMatrix[j] = DIR_LEFT;
  }

  for (let i = 1; i <= len1; i++) {
    const c1 = seq1[i - 1] ?? '';
    const rowOffset = i * cols;
    const prevRowOffset = (i - 1) * cols;

    for (let j = 1; j <= len2; j++) {
      const c2 = seq2[j - 1] ?? '';
      const match = (fMatrix[prevRowOffset + (j - 1)] ?? 0) + getScore(c1, c2);
      const del = (fMatrix[prevRowOffset + j] ?? 0) - GAP_PENALTY;
      const ins = (fMatrix[rowOffset + (j - 1)] ?? 0) - GAP_PENALTY;

      const { maxVal, dir } = max3(match, del, ins);
      fMatrix[rowOffset + j] = maxVal;
      ptrMatrix[rowOffset + j] = dir;
    }
  }

  const alignedPairs: AlignedPair[] = [];
  let i = len1;
  let j = len2;

  while (i > 0 || j > 0) {
    const dir = ptrMatrix[i * cols + j] ?? DIR_LEFT;
    if (i > 0 && j > 0 && dir === DIR_DIAG) {
      alignedPairs.push({ char1: seq1[i - 1] ?? '', char2: seq2[j - 1] ?? '' });
      i--;
      j--;
    } else if (i > 0 && dir === DIR_UP) {
      alignedPairs.push({ char1: seq1[i - 1] ?? '', char2: null });
      i--;
    } else {
      alignedPairs.push({ char1: null, char2: seq2[j - 1] ?? '' });
      j--;
    }
  }

  alignedPairs.reverse();

  // 100点満点のスコア算出処理
  const actualScore = fMatrix[len1 * cols + len2] ?? 0;
  const maxScore = len1 * SCORE_EXACT_MATCH;
  let percentage = 0.0;

  if (maxScore > 0) {
    percentage = (actualScore / maxScore) * 100.0;
    if (percentage < 0.0) {
      percentage = 0.0;
    }
  }

  return {
    actualScore,
    maxScore,
    percentage,
    matchRate: Math.round(percentage),
    alignedPairs,
  };
}

/** 同じ DiffType が続くセグメントを1つにまとめる */
function appendDiffSegment(segments: DiffSegment[], type: DiffType, text: string): void {
  if (text === '') {
    return;
  }
  const lastSegment = segments[segments.length - 1];
  if (lastSegment !== undefined && lastSegment.type === type) {
    lastSegment.text += text;
  } else {
    segments.push({ type, text });
  }
}

/** アラインメント結果から DiffSegment の配列を組み立てる */
function buildSegmentsFromPairs(alignedPairs: readonly AlignedPair[]): DiffSegment[] {
  const segments: DiffSegment[] = [];

  for (const pair of alignedPairs) {
    if (pair.char1 !== null && pair.char2 !== null) {
      if (pair.char1 === pair.char2) {
        appendDiffSegment(segments, 'match', pair.char1);
      } else {
        appendDiffSegment(segments, 'missing', pair.char1);
        appendDiffSegment(segments, 'extra', pair.char2);
      }
    } else if (pair.char1 !== null) {
      appendDiffSegment(segments, 'missing', pair.char1);
    } else if (pair.char2 !== null) {
      appendDiffSegment(segments, 'extra', pair.char2);
    }
  }

  return segments;
}

/** 句読点・空白・改行・記号を除き、全角と半角をそろえ、ひらがなに変換する */
export function normalizeText(text: string): string {
  return convertToHiragana(text).replace(NON_COMPARED_CHAR_PATTERN, '');
}

/** 2つの文の編集距離を返す */
export function calculateEditDistance(source: string, target: string): number {
  const seq1 = Array.from(source);
  const seq2 = Array.from(target);
  const len1 = seq1.length;
  const len2 = seq2.length;
  const cols = len2 + 1;

  const dp = new Int32Array((len1 + 1) * cols);
  for (let i = 0; i <= len1; i++) {
    dp[i * cols] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    const rowOffset = i * cols;
    const prevRowOffset = (i - 1) * cols;
    for (let j = 1; j <= len2; j++) {
      const cost = seq1[i - 1] === seq2[j - 1] ? 0 : 1;
      const del = (dp[prevRowOffset + j] ?? 0) + 1;
      const ins = (dp[rowOffset + (j - 1)] ?? 0) + 1;
      const sub = (dp[prevRowOffset + (j - 1)] ?? 0) + cost;
      dp[rowOffset + j] = Math.min(del, ins, sub);
    }
  }

  return dp[len1 * cols + len2] ?? 0;
}

/** 一致度(0〜100の整数)を返す(4.2の式) */
export function calculateMatchRate(scriptText: string, transcript: string): number {
  const seq1 = Array.from(normalizeText(scriptText));
  const seq2 = Array.from(normalizeText(transcript));
  return needlemanWunsch(seq1, seq2).matchRate;
}

/** 台本との違いを区分分けして返す */
export function buildDiffSegments(scriptText: string, transcript: string): DiffSegment[] {
  const seq1 = Array.from(normalizeText(scriptText));
  const seq2 = Array.from(normalizeText(transcript));
  const { alignedPairs } = needlemanWunsch(seq1, seq2);
  return buildSegmentsFromPairs(alignedPairs);
}

/** calculateMatchRate と buildDiffSegments をまとめて行う。画面側はこれだけを呼ぶ */
export function compareWithScript(scriptText: string, transcript: string): MatchResult {
  const seq1 = Array.from(normalizeText(scriptText));
  const seq2 = Array.from(normalizeText(transcript));
  const { matchRate, alignedPairs } = needlemanWunsch(seq1, seq2);
  return {
    matchRate,
    segments: buildSegmentsFromPairs(alignedPairs),
  };
}
