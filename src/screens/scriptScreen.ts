import { countCharacters } from '../analysis/speedCalculator';
import { appState } from '../appState';
import { SCRIPT_MAX_LENGTH } from '../constants';
import { createScriptSource, getPresetScripts, validateScript } from '../session/scriptSetup';
import type { AppErrorCode, ScreenId } from '../types';
import { createButton, createErrorArea, renderErrorMessage } from './screenParts';

// SCR-02 台本設定(要件定義書 5.1)
// ホーム画面のメニューで「自分の台本」(custom)か「お題文」(preset)を選んだときだけ通る
// 「決定」でホーム画面に戻り、台本が「開始」ボタンの上に出る。練習はホーム画面の「開始」で始める

/** 台本設定画面を描く */
export function renderScriptScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const mode = appState.mode === 'preset' ? 'preset' : 'custom';
  // 前に決めた台本があれば、入力欄や選択に入れておく
  const currentScript = appState.script;
  const errorArea = createErrorArea();

  const heading = document.createElement('h1');
  heading.textContent = mode === 'custom' ? '台本を入力' : 'お題文を選ぶ';

  // 自分の台本: 入力欄と現在の文字数
  const scriptInput = document.createElement('textarea');
  scriptInput.className = 'script-input';
  scriptInput.rows = 12;
  scriptInput.placeholder = 'ここに台本を入力してください。';
  if (mode === 'custom' && currentScript !== null) {
    scriptInput.value = currentScript.text;
  }
  const charCountElement = document.createElement('p');
  charCountElement.className = 'char-count';

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
  presetPreview.className = 'script-text preset-preview';

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
    if (
      mode === 'preset' &&
      currentScript !== null &&
      currentScript.title === preset.title &&
      currentScript.text === preset.text
    ) {
      radio.checked = true;
      selectedPresetId = preset.id;
      presetPreview.textContent = preset.text;
    }
    label.append(radio, ` ${preset.title}(${countCharacters(preset.text)} 文字)`);
    presetList.append(label);
  }

  /** 「決定」が押されたとき: F-01(入力チェック) → SCR-01 */
  const handleDecideClick = (): void => {
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
    appState.mode = mode;
    appState.script = createScriptSource(mode, input);
    showScreen('home');
  };

  const decideButton = createButton('決定', handleDecideClick);
  decideButton.classList.add('button-primary');
  const actions = document.createElement('div');
  actions.className = 'page-actions';
  actions.append(
    decideButton,
    createButton('戻る', () => showScreen('home')),
  );

  container.append(heading);
  if (mode === 'custom') {
    container.append(scriptInput, charCountElement);
  } else {
    container.append(presetList, presetPreview);
  }
  container.append(errorArea, actions);
}
