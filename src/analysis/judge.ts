import { SPEED_MAX_CPM, SPEED_MIN_CPM } from '../constants';
import type { AudienceSpriteKey, SpeedLevel } from '../types';

// 速さの判定(要件定義書 4.1, 4.3)

/** 速さを3段階に判定する。境界値(SPEED_MIN_CPM、SPEED_MAX_CPM)は 'optimal' に含める */
export function judgeSpeed(cpm: number): SpeedLevel {
  if (cpm < SPEED_MIN_CPM) {
    return 'slow';
  }
  if (cpm > SPEED_MAX_CPM) {
    return 'fast';
  }
  return 'optimal';
}

/** スプライトキーを返す(4.3の表) */
export function getAudienceSpriteKey(speedLevel: SpeedLevel): AudienceSpriteKey {
  return `audience_${speedLevel}`;
}
