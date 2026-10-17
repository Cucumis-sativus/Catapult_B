import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechRecognizer } from './speechRecognizer';

/** テスト用の認識結果1件([文字, 確定したか]) */
type FakeResult = [transcript: string, isFinal: boolean];

/** ブラウザの SpeechRecognition の代わり。作られたものを順に覚えておく */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }

  /** result イベントを起こす。results はこの認識で出た結果すべて(ブラウザと同じ) */
  emitResult(resultIndex: number, results: FakeResult[]): void {
    this.onresult?.({
      resultIndex,
      results: results.map(([transcript, isFinal]) => ({
        isFinal,
        length: 1,
        0: { transcript },
      })),
    });
  }
}

describe('SpeechRecognizer (F-03)', () => {
  let recognizer: SpeechRecognizer;
  let calls: [string, boolean][];

  /** いま使われている FakeRecognition を返す */
  const getRecognition = (): FakeRecognition => {
    const recognition = FakeRecognition.instances.at(-1);
    if (!recognition) {
      throw new Error('SpeechRecognition が作られていません');
    }
    return recognition;
  };

  beforeEach(() => {
    FakeRecognition.instances = [];
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition });
    calls = [];
    recognizer = new SpeechRecognizer();
    recognizer.onResult((transcript, isFinal) => calls.push([transcript, isFinal]));
    recognizer.start();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('日本語で、連続して、途中結果ありで認識を始める', () => {
    const recognition = getRecognition();
    expect(recognition.lang).toBe('ja-JP');
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.start).toHaveBeenCalledTimes(1);
  });

  it('途中結果が複数のかたまりに分かれて届いたときは、つなげて1つの途中結果として渡す', () => {
    getRecognition().emitResult(0, [
      ['拙者親方と', false],
      ['申すは', false],
    ]);

    expect(calls).toEqual([['拙者親方と申すは', false]]);
  });

  it('変わったかたまりだけが resultIndex 以降に来ても、途中結果の全体を渡す', () => {
    const recognition = getRecognition();
    recognition.emitResult(0, [
      ['拙者親方と', false],
      ['申す', false],
    ]);
    recognition.emitResult(1, [
      ['拙者親方と', false],
      ['申すは', false],
    ]);

    expect(calls.at(-1)).toEqual(['拙者親方と申すは', false]);
  });

  it('確定した結果は、新しく確定したものだけを1回ずつ渡す', () => {
    const recognition = getRecognition();
    recognition.emitResult(0, [
      ['こんにちは。', true],
      ['今日', false],
    ]);
    recognition.emitResult(1, [
      ['こんにちは。', true],
      ['今日は', false],
    ]);
    recognition.emitResult(1, [
      ['こんにちは。', true],
      ['今日はいい天気です。', true],
    ]);

    expect(calls).toEqual([
      ['こんにちは。', true],
      ['今日', false],
      ['今日は', false],
      ['今日はいい天気です。', true],
      ['', false],
    ]);
  });

  it('確定する前に認識が止まったときは、途中結果を確定として渡してから再開する', () => {
    const recognition = getRecognition();
    recognition.emitResult(0, [['お江戸を発って', false]]);

    recognition.onend?.();

    expect(calls.at(-1)).toEqual(['お江戸を発って', true]);
    expect(recognition.start).toHaveBeenCalledTimes(2);
  });

  it('確定してから認識が止まったときは、同じ文を二重に渡さない', () => {
    const recognition = getRecognition();
    recognition.emitResult(0, [['二十里上方', false]]);
    recognition.emitResult(0, [['二十里上方', true]]);

    recognition.onend?.();

    expect(calls.filter(([, isFinal]) => isFinal)).toEqual([['二十里上方', true]]);
    expect(recognition.start).toHaveBeenCalledTimes(2);
  });

  it('stop() のあとに届いた結果と終了は使わず、再開もしない', () => {
    const recognition = getRecognition();
    recognizer.stop();

    recognition.emitResult(0, [['止めたあとの結果', true]]);
    recognition.onend?.();

    expect(calls).toEqual([]);
    expect(recognition.start).toHaveBeenCalledTimes(1);
  });
});
