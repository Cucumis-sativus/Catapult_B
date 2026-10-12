import type { DiffSegment, MatchResult } from '../types';

// 一致度の計算(F-06、要件定義書 4.2)

/** 句読点・空白・改行・記号を除き、全角と半角をそろえる */
export function normalizeText(text: string): string {
  // TODO(F-06): 未実装。仮の値を返している
  return text;
}

/** 2つの文の編集距離を返す */
export function calculateEditDistance(source: string, target: string): number {
  // TODO(F-06): 未実装。仮の値を返している
  return 0;
}

/** 一致度(0〜100の整数)を返す(4.2の式) */
export function calculateMatchRate(scriptText: string, transcript: string): number {
  // TODO(F-06): 未実装。仮の値を返している
  return 0;
}

/** 台本との違いを区分分けして返す */
export function buildDiffSegments(scriptText: string, transcript: string): DiffSegment[] {
  // TODO(F-06): 未実装。仮の値を返している
  return [];
}

/** calculateMatchRate と buildDiffSegments をまとめて行う。画面側はこれだけを呼ぶ */
export function compareWithScript(scriptText: string, transcript: string): MatchResult {
  // TODO(F-06): 未実装。仮の値を返している
  return { matchRate: 0, segments: [] };
}
