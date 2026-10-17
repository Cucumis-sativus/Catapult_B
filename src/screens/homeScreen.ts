import { appState } from '../appState';
import { AudienceView } from '../audience/audienceView';
import { PRACTICE_MODE_LABELS, SPEED_MAX_CPM, SPEED_MIN_CPM } from '../constants';
import type { PracticeMode, ScreenId, ScriptSource } from '../types';
import {
  createButton,
  createErrorArea,
  createScriptPanel,
  formatDurationSec,
  startPractice,
} from './screenParts';

// SCR-01 ホーム(要件定義書 5.1)
// 観客の前に立つ画面。起動時は台本なしモードで、「開始」を押すと練習が始まる
// 練習モードの切り替えと履歴は右上のメニューから開く。使い方と注意書きは起動時にポップアップで出す
// 文言は仮。システム名は【未決定】

/** メニューに並べる練習モードの順番 */
const MENU_MODES: readonly PracticeMode[] = ['free', 'custom', 'preset'];

/** 使い方のポップアップを、起動してからもう出したか(出すのは起動時の1回だけ) */
let isUsageShown = false;

/** 台本設定画面に移る前のモードと台本。台本を決めずに戻ってきたら、これに戻す */
let previousMode: PracticeMode = 'free';
let previousScript: ScriptSource | null = null;

/** ホーム画面を描く */
export function renderHomeScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  // 台本設定画面で台本を決めずに戻ってきたときは、移る前のモードと台本に戻す
  if (appState.mode !== 'free' && appState.script === null) {
    appState.mode = previousMode;
    appState.script = previousScript;
  }
  const mode: PracticeMode = appState.mode ?? 'free';
  const script = mode === 'free' ? null : appState.script;

  const errorArea = createErrorArea();
  const usageDialog = createUsageDialog();

  /** 「開始」が押されたとき: F-02 → SCR-03 */
  const handleStartClick = async (): Promise<void> => {
    // マイクの許可を待つあいだに2回押されないようにする
    startButton.disabled = true;
    try {
      await startPractice(mode, script, errorArea, showScreen);
    } finally {
      startButton.disabled = false;
    }
  };

  /** メニューで練習モードが選ばれたとき。台本なしはこの画面のまま、台本を使うモードは F-01 → SCR-02 */
  const handleModeSelect = (selectedMode: PracticeMode): void => {
    if (selectedMode === 'free') {
      appState.mode = 'free';
      appState.script = null;
      showScreen('home');
      return;
    }
    previousMode = mode;
    previousScript = script;
    // 別のモードに切り替えるときは、前の台本を持ち越さない
    if (selectedMode !== mode) {
      appState.script = null;
    }
    appState.mode = selectedMode;
    showScreen('script');
  };

  const stage = document.createElement('div');
  stage.className = 'stage';

  // 背景と観客(F-05)。まだ練習していないので通常の観客を出す
  const scene = document.createElement('div');
  scene.className = 'stage-scene';
  new AudienceView(scene);

  // 左上: 経過時間と練習モード
  const status = document.createElement('div');
  status.className = 'stage-status';
  status.innerHTML = `
    <p class="elapsed-time"><span class="elapsed-label">経過時間</span><span>${formatDurationSec(0)}</span></p>
    <p class="mode-chip">${PRACTICE_MODE_LABELS[mode]}</p>
  `;

  // 右上: 練習モードの切り替えと履歴のメニュー
  const menu = createStageMenu(mode, {
    onModeSelect: handleModeSelect,
    onHistoryClick: () => showScreen('history'),
    onUsageClick: () => usageDialog.showModal(),
  });

  // 下の中央: 台本(あるモードだけ)と「開始」ボタン
  const controls = document.createElement('div');
  controls.className = 'stage-controls';
  if (script !== null) {
    controls.append(createScriptPanel(script));
  }
  const startButton = createButton('開始', () => void handleStartClick());
  startButton.classList.add('stage-button', 'stage-button-start');
  controls.append(errorArea, startButton);

  stage.append(scene, status, menu, controls);
  container.append(stage, usageDialog);

  // 使い方と注意書きは、起動時に1回だけポップアップで出す
  if (!isUsageShown) {
    isUsageShown = true;
    usageDialog.showModal();
  }
}

/** メニューで選ばれたときに呼ぶ関数 */
interface StageMenuHandlers {
  onModeSelect: (mode: PracticeMode) => void;
  onHistoryClick: () => void;
  onUsageClick: () => void;
}

/** 右上のハンバーガーメニューを作る(練習モードの切り替え、履歴、使い方) */
function createStageMenu(currentMode: PracticeMode, handlers: StageMenuHandlers): HTMLElement {
  const menu = document.createElement('nav');
  menu.className = 'stage-menu';
  menu.setAttribute('aria-label', 'メニュー');

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'menu-toggle';
  toggleButton.setAttribute('aria-controls', 'stage-menu-panel');
  toggleButton.innerHTML = '<span></span><span></span><span></span>';

  const panel = document.createElement('div');
  panel.id = 'stage-menu-panel';
  panel.className = 'menu-panel';

  /** メニューが開いているか */
  let isMenuOpen = false;

  /** メニューを開く・閉じる */
  const setMenuOpen = (isOpen: boolean): void => {
    isMenuOpen = isOpen;
    panel.hidden = !isOpen;
    toggleButton.setAttribute('aria-expanded', String(isOpen));
    toggleButton.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
  };
  setMenuOpen(false);
  toggleButton.addEventListener('click', () => setMenuOpen(!isMenuOpen));

  /** メニューの項目を作る。選ばれたらメニューを閉じてから onSelect を呼ぶ */
  const createMenuItem = (label: string, onSelect: () => void): HTMLButtonElement => {
    const item = createButton(label, () => {
      setMenuOpen(false);
      onSelect();
    });
    item.className = 'menu-item';
    return item;
  };

  for (const mode of MENU_MODES) {
    const item = createMenuItem(PRACTICE_MODE_LABELS[mode], () => handlers.onModeSelect(mode));
    if (mode === currentMode) {
      item.setAttribute('aria-current', 'true');
    }
    panel.append(item);
  }
  const divider = document.createElement('hr');
  divider.className = 'menu-divider';
  panel.append(
    divider,
    createMenuItem('履歴を見る', handlers.onHistoryClick),
    createMenuItem('使い方', handlers.onUsageClick),
  );

  // メニューの外を押したとき(フォーカスが外に出たとき)と Esc で閉じる
  menu.addEventListener('focusout', (event) => {
    const nextTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!menu.contains(nextTarget)) {
      setMenuOpen(false);
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen) {
      setMenuOpen(false);
      toggleButton.focus();
    }
  });

  menu.append(toggleButton, panel);
  return menu;
}

/** 使い方と、マイクと音声送信の注意書き(要件定義書 3章)のポップアップを作る */
function createUsageDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = 'usage-dialog';
  dialog.setAttribute('aria-labelledby', 'usage-dialog-title');

  const body = document.createElement('div');
  body.className = 'usage-dialog-body';
  body.innerHTML = `
    <h1 id="usage-dialog-title">スピーチ練習アプリ</h1>
    <section>
      <h2>使い方</h2>
      <ol>
        <li>「開始」を押し、マイクの使用を許可して、観客に向かって話します。</li>
        <li>観客の反応と話す速さ(1分あたりの文字数)を見ながら、速さを直します。${SPEED_MIN_CPM}〜${SPEED_MAX_CPM}文字/分が最適です。</li>
        <li>「終了」を押すと結果が出ます。話した内容の文字起こしは結果で見られます。</li>
        <li>練習モードは右上のメニューで切り替えます。最初は「${PRACTICE_MODE_LABELS.free}」です。「${PRACTICE_MODE_LABELS.custom}」「${PRACTICE_MODE_LABELS.preset}」では、台本が「開始」の上に出て、練習後に台本との一致度がわかります。</li>
      </ol>
    </section>
    <section class="notice">
      <h2>ご注意</h2>
      <ul>
        <li>話した音声は、文字起こしのためにブラウザの音声認識サービスへ送信されます。インターネット接続が必要です。</li>
        <li>録音ファイルは保存しません。文字起こし・台本・結果は、この端末の中にだけ保存します。</li>
        <li>ChromeまたはEdgeで開き、マイクの使用を許可してください。</li>
      </ul>
    </section>
  `;

  const closeButton = createButton('はじめる', () => dialog.close());
  closeButton.classList.add('button-primary');
  body.append(closeButton);
  dialog.append(body);

  // ポップアップの外(背景)を押しても閉じる
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  return dialog;
}
