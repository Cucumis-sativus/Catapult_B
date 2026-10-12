import { countCharacters } from '../analysis/speedCalculator';
import { appState } from '../appState';
import { SCRIPT_MAX_LENGTH } from '../constants';
import { createScriptSource, getPresetScripts, validateScript } from '../session/scriptSetup';
import type { AppErrorCode, ScreenId } from '../types';
import { createButton, createErrorArea, renderErrorMessage, startPractice } from './screenParts';

// SCR-02 台本設定(要件定義書 5.1)
// 自分の台本モード(custom)とお題文モード(preset)でだけ通る

/** 台本設定画面を描く */
export function renderScriptScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const mode = appState.mode === 'preset' ? 'preset' : 'custom';
  const errorArea = createErrorArea();

  const heading = document.createElement('h1');
  heading.textContent = mode === 'custom' ? '台本を入力' : 'お題文を選ぶ';

  // 自分の台本: 入力欄と現在の文字数
  const scriptInput = document.createElement('textarea');
  scriptInput.className = 'script-input';
  scriptInput.rows = 12;
  scriptInput.placeholder = 'ここに台本を入力してください。';
  const charCountElement = document.createElement('p');

  /** 入力された台本の文字数を出し直す */
  const handleScriptInput = (): void => {
    charCountElement.textContent = `${countCharacters(scriptInput.value)} / ${SCRIPT_MAX_LENGTH} 文字`;
  };
  scriptInput.addEventListener('input', handleScriptInput);
  handleScriptInput();

  // お題文: 一覧(タイトル、文字数)と、選んだ文のプレビュー
  let selectedPresetId: string | null = null;
  const presetList = document.createElement('div');
  presetList.className = 'preset-list';
  const presetPreview = document.createElement('p');
  presetPreview.className = 'script-text';

  const presetScripts = getPresetScripts();
  if (presetScripts.length === 0) {
    presetList.textContent = 'お題文がありません。';
  }
  for (const preset of presetScripts) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'preset';
    radio.value = preset.id;
    radio.addEventListener('change', () => {
      selectedPresetId = preset.id;
      presetPreview.textContent = preset.text;
      renderErrorMessage(errorArea, null);
    });
    label.append(radio, ` ${preset.title}(${countCharacters(preset.text)} 文字)`);
    presetList.append(label);
  }

  /** 「練習を始める」が押されたとき: F-01(入力チェック)、F-02 → SCR-03 */
  const handleStartClick = (): void => {
    let errorCode: AppErrorCode | null;
    let input: string;
    if (mode === 'custom') {
      input = scriptInput.value;
      errorCode = validateScript(input);
    } else {
      input = selectedPresetId ?? '';
      errorCode = selectedPresetId === null ? 'script-not-selected' : null;
    }
    if (errorCode !== null) {
      renderErrorMessage(errorArea, errorCode);
      return;
    }
    const script = createScriptSource(mode, input);
    void startPractice(mode, script, errorArea, showScreen);
  };

  container.append(heading);
  if (mode === 'custom') {
    container.append(scriptInput, charCountElement);
  } else {
    container.append(presetList, presetPreview);
  }
  container.append(
    errorArea,
    createButton('練習を始める', handleStartClick),
    createButton('戻る', () => showScreen('home')),
  );
}
