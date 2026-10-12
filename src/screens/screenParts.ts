import { appState } from '../appState';
import { ERROR_MESSAGES } from '../constants';
import { startSession } from '../session/practiceSession';
import type { AppErrorCode, PracticeMode, ScreenId, ScriptSource } from '../types';

// 画面づくりで共通に使う部品

/** ボタンを作る */
export function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

/** エラーメッセージを出す欄を作る。最初は隠しておく */
export function createErrorArea(): HTMLParagraphElement {
  const errorArea = document.createElement('p');
  errorArea.className = 'error-message';
  errorArea.setAttribute('role', 'alert');
  errorArea.hidden = true;
  return errorArea;
}

/** エラーメッセージ(5.3)を出す。code が null なら消す */
export function renderErrorMessage(errorArea: HTMLElement, code: AppErrorCode | null): void {
  if (code === null) {
    errorArea.textContent = '';
    errorArea.hidden = true;
    return;
  }
  errorArea.textContent = ERROR_MESSAGES[code];
  errorArea.hidden = false;
}

/** 値が AppErrorCode かどうかを返す */
export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && value in ERROR_MESSAGES;
}

/** 秒を「分:秒」の形にする(例: 75 → '1:15') */
export function formatDurationSec(durationSec: number): string {
  const totalSec = Math.floor(durationSec);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * F-02 を呼んで練習を始め、練習画面に移る。
 * 始められなかったときはエラーメッセージを出し、画面は移らない(5.2)
 */
export async function startPractice(
  mode: PracticeMode,
  script: ScriptSource | null,
  errorArea: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): Promise<void> {
  renderErrorMessage(errorArea, null);
  try {
    await startSession(mode, script);
  } catch (error) {
    if (isAppErrorCode(error)) {
      renderErrorMessage(errorArea, error);
      return;
    }
    throw error;
  }
  appState.mode = mode;
  appState.script = script;
  showScreen('practice');
}
