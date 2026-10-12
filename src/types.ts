// 型(要件定義書 8.4)

export type SpeedLevel = 'slow' | 'optimal' | 'fast';

// 例: 'audience_fast'
export type AudienceSpriteKey = `audience_${SpeedLevel}`;

// free: 台本なし / custom: 自分の台本 / preset: お題文
export type PracticeMode = 'free' | 'custom' | 'preset';

export type ScreenId = 'home' | 'script' | 'practice' | 'result' | 'history';

export type AppErrorCode =
  | 'script-empty'
  | 'script-too-long'
  | 'script-not-selected'
  | 'mic-denied'
  | 'mic-not-found'
  | 'speech-unsupported'
  | 'speech-network'
  | 'storage-failed';

// 内蔵のお題文(7章)
export interface PresetScript {
  id: string;
  title: string;
  text: string;
}

// 練習で使う台本。台本なしモードでは null を使う
export interface ScriptSource {
  title: string;
  text: string;
}

// 1回の判定ごとの計測値
export interface MeasurementSample {
  elapsedSec: number; // 練習開始からの経過秒
  cpm: number; // 速さ(文字/分)
  speedLevel: SpeedLevel;
}

// 台本と文字起こしの違い(4.2)
export type DiffType = 'match' | 'missing' | 'extra';

export interface DiffSegment {
  type: DiffType;
  text: string;
}

// 一致度の計算結果
export interface MatchResult {
  matchRate: number; // 0〜100の整数
  segments: DiffSegment[];
}

// 保存する練習記録(7章)
export interface SessionRecord {
  id: string;
  startedAt: string;
  mode: PracticeMode;
  scriptTitle: string | null;
  scriptText: string | null;
  durationSec: number;
  transcript: string;
  charCount: number;
  averageCpm: number;
  speedOptimalRatio: number;
  matchRate: number | null;
  samples?: MeasurementSample[]; // 保存するかは未決定
}
