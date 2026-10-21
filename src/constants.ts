import type { AppErrorCode, PracticeMode, SpeedLevel } from './types';

// 定数(要件定義書 8.3)
// 【未決定】と書いたものは仮値。決まったらここだけを書き換える

/** 速さの最適範囲の下限(文字/分) */
export const SPEED_MIN_CPM = 250;

/** 速さの最適範囲の上限(文字/分) */
export const SPEED_MAX_CPM = 350;

/** 速さを計算する対象期間(秒)【未決定:仮値10】 */
export const SPEED_WINDOW_SEC = 10;

/** 文字が増えないまま この秒数たったら、黙っているとみなして速さの判定を止める(4.1)【未決定:仮値3】 */
export const SPEED_SILENCE_SEC = 3;

/** 判定と観客更新の間隔(ミリ秒)【未決定:仮値1000】 */
export const JUDGE_INTERVAL_MS = 1000;

/** 自分の台本の最大文字数【未決定:仮値5000】 */
export const SCRIPT_MAX_LENGTH = 5000;

/** 一致度を「良い」とする下限(%)。評価の段階を設ける場合のみ使う【未決定】 */
export const MATCH_RATE_GOOD: number | null = null;

/** 音声認識の言語 */
export const SPEECH_LANG = 'ja-JP';

/** 履歴の保存キー */
export const STORAGE_KEY = 'speechPractice.sessions';

/** 履歴の保存件数の上限【未決定:仮値50】 */
export const MAX_HISTORY_COUNT = 50;

/** 観客画像の置き場所 */
export const SPRITE_BASE_PATH = '/sprites/';

/** 練習モードの表示名(1章) */
export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  free: '台本なし',
  custom: '自分の台本',
  preset: 'お題文',
};

/** 速さの判定の表示名(4.1) */
export const SPEED_LEVEL_LABELS: Record<SpeedLevel, string> = {
  slow: '遅い',
  optimal: '最適',
  fast: '速い',
};

/** エラーメッセージ(5.3)【未決定:最終的な文言】 */
export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  'script-empty': '台本を入力してください。',
  'script-too-long': '台本が長すぎます。',
  'script-not-selected': 'お題文を選んでください。',
  'mic-denied': 'マイクの使用を許可してください。',
  'mic-not-found': 'マイクが接続されているか確認してください。',
  'speech-unsupported': 'ChromeまたはEdgeで開いてください。',
  'speech-network': 'インターネット接続を確認してください。',
  'storage-failed': '結果を保存できませんでした。',
};
