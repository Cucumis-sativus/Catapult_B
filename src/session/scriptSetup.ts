import type { AppErrorCode, PracticeMode, PresetScript, ScriptSource } from '../types';
import { SCRIPT_MAX_LENGTH } from '../constants';
import { PRESET_SCRIPTS } from '../data/presetScripts';

// 台本の設定と入力チェック(F-01、要件定義書 5.3)

/** 内蔵のお題文の一覧を返す */
export function getPresetScripts(): PresetScript[] {
  return PRESET_SCRIPTS;
}

/** 自分の台本の入力チェック。問題なければ null */
export function validateScript(text: string): AppErrorCode | null {
  // 文字数が上限を超えている場合
  if (text.length > SCRIPT_MAX_LENGTH) {
    return 'script-too-long';
  }

  // 空欄、句読点、空白だけの場合
  const meaningfulText = text.replace(/[\s\p{P}]/gu, '');

  if (meaningfulText.length === 0) {
    return 'script-empty';
  }

  // 問題がない場合
  return null;
}

/**
 * 練習で使う台本を作る。
 * input は自分の台本の本文、またはお題文のID。台本なしは null
 */
export function createScriptSource(mode: PracticeMode, input: string): ScriptSource | null {
  // 台本なしモード
  if (mode === 'free') {
    return null;
  }

  // 自分の台本モード
  if (mode === 'custom') {
    return {
      title: '自分の台本',
      text: input,
    };
  }

  // お題文モード
  const preset = PRESET_SCRIPTS.find((script) => script.id === input);

  if (preset === undefined) {
    return null;
  }

  return {
    title: preset.title,
    text: preset.text,
  };
}
