import type {
  AppErrorCode,
  MeasurementSample,
  PracticeMode,
  ScriptSource,
  SessionRecord,
} from '../types';

// 練習の開始・終了・集計(F-02, F-07)

/**
 * 認識と計測を始める。
 * 始められなかったときは AppErrorCode('mic-denied' など)で reject する
 */
export async function startSession(mode: PracticeMode, script: ScriptSource | null): Promise<void> {
  // TODO(F-02): 未実装
}

/** 認識と計測を止め、一致度を計算して記録を返す */
export function stopSession(): SessionRecord {
  // TODO(F-07): 未実装。画面を確かめられるよう、空の記録を返している
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    mode: 'free',
    scriptTitle: null,
    scriptText: null,
    durationSec: 0,
    transcript: '',
    charCount: 0,
    averageCpm: 0,
    speedOptimalRatio: 0,
    matchRate: null,
  };
}

/** JUDGE_INTERVAL_MS ごとに呼ばれ、計測と判定を1回行う */
export function updateJudgement(): MeasurementSample {
  // TODO(F-04): 未実装。仮の値を返している
  return { elapsedSec: 0, cpm: 0, speedLevel: 'optimal' };
}

/** 平均値と割合を集計する */
export function buildSessionRecord(
  samples: MeasurementSample[],
  transcript: string,
): SessionRecord {
  // TODO(F-07): 未実装。stopSession の仮の値と同じものを返している
  return stopSession();
}

/** 練習中の文字起こし全文を返す(練習画面に出す) */
export function getTranscript(): string {
  // TODO(F-03): 未実装。仮の値を返している
  return '';
}

/** 練習中に起きたエラー('speech-network' など)を受け取る関数を登録する */
export function onSessionError(callback: (code: AppErrorCode) => void): void {
  // TODO(F-03): 未実装
}
