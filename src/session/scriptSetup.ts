import type { AppErrorCode, PracticeMode, PresetScript, ScriptSource } from '../types';

// 台本の設定と入力チェック(F-01、要件定義書 5.3)

/** 内蔵のお題文の一覧を返す(src/data/presetScripts.ts から) */
export function getPresetScripts(): PresetScript[] {
  // TODO(F-01): 未実装。仮の値を返している
  return [];
}

/** 自分の台本の入力チェック。問題なければ null */
export function validateScript(text: string): AppErrorCode | null {
  // TODO(F-01): 未実装。仮の値を返している
  return null;
}

/**
 * 練習で使う台本を作る。
 * input は自分の台本の本文、またはお題文のID。台本なしは null
 */
export function createScriptSource(mode: PracticeMode, input: string): ScriptSource | null {
  // TODO(F-01): 未実装。仮の値を返している
  return null;
}
