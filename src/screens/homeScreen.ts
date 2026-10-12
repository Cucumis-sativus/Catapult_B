import { appState } from '../appState';
import { SPEED_MAX_CPM, SPEED_MIN_CPM } from '../constants';
import type { PracticeMode, ScreenId } from '../types';
import { createButton, createErrorArea, startPractice } from './screenParts';

// SCR-01 ホーム(要件定義書 5.1)
// 文言は仮。システム名は【未決定】

/** ホーム画面を描く */
export function renderHomeScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const errorArea = createErrorArea();

  /** 「台本なしで練習」が押されたとき: F-02 → SCR-03 */
  const handleFreeClick = (): void => {
    void startPractice('free', null, errorArea, showScreen);
  };

  /** 「自分の台本で練習」「お題文で練習」が押されたとき: F-01 → SCR-02 */
  const handleScriptModeClick = (mode: PracticeMode): void => {
    appState.mode = mode;
    appState.script = null;
    showScreen('script');
  };

  const heading = document.createElement('h1');
  heading.textContent = 'スピーチ練習アプリ';

  // 使い方
  const usage = document.createElement('section');
  usage.innerHTML = `
    <h2>使い方</h2>
    <ol>
      <li>練習モードを選びます。</li>
      <li>マイクの使用を許可して、画面の観客に向かって話します。</li>
      <li>話す速さ(1分あたりの文字数)と観客の反応を見ながら、速さを直します。${SPEED_MIN_CPM}〜${SPEED_MAX_CPM}文字/分が最適です。</li>
      <li>「終了」を押すと結果が出ます。台本があるモードでは、台本との一致度も出ます。</li>
    </ol>
  `;

  // マイクと音声送信の注意書き(要件定義書 3章)
  const notice = document.createElement('section');
  notice.className = 'notice';
  notice.innerHTML = `
    <h2>ご注意</h2>
    <ul>
      <li>話した音声は、文字起こしのためにブラウザの音声認識サービスへ送信されます。インターネット接続が必要です。</li>
      <li>録音ファイルは保存しません。文字起こし・台本・結果は、この端末の中にだけ保存します。</li>
      <li>ChromeまたはEdgeで開き、マイクの使用を許可してください。</li>
    </ul>
  `;

  // 3つの練習モード
  const modes = document.createElement('section');
  const modesHeading = document.createElement('h2');
  modesHeading.textContent = '練習モード';
  modes.append(
    modesHeading,
    createModeItem(
      createButton('台本なしで練習', handleFreeClick),
      '台本を使わずに自由に話し、話す速さを練習します。',
    ),
    createModeItem(
      createButton('自分の台本で練習', () => handleScriptModeClick('custom')),
      '自分で入力した台本を読み上げます。練習後に台本との一致度がわかります。',
    ),
    createModeItem(
      createButton('お題文で練習', () => handleScriptModeClick('preset')),
      '外郎売などのお題文を読み上げます。練習後にお題文との一致度がわかります。',
    ),
    errorArea,
  );

  container.append(
    heading,
    usage,
    notice,
    modes,
    createButton('履歴を見る', () => showScreen('history')),
  );
}

/** 練習モードのボタンと説明を1行にまとめる */
function createModeItem(button: HTMLButtonElement, description: string): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'mode-item';
  const descriptionElement = document.createElement('p');
  descriptionElement.textContent = description;
  item.append(button, descriptionElement);
  return item;
}
