import type { AudienceSpriteKey, SpeedLevel } from '../types';

// 速さの判定(要件定義書 4.1, 4.3)

/** 速さを3段階に判定する。境界値(SPEED_MIN_CPM、SPEED_MAX_CPM)は 'optimal' に含める */
export function judgeSpeed(cpm: number): SpeedLevel {
  // TODO(F-04): 未実装。仮の値を返している
  return 'optimal';
}

/** スプライトキーを返す(4.3の表) */
export function getAudienceSpriteKey(speedLevel: SpeedLevel): AudienceSpriteKey {
  // TODO(F-05): 未実装。仮の値を返している
  return 'audience_optimal';
}
