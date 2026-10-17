import { compareWithScript } from '../analysis/scriptMatcher';
import { appState } from '../appState';
import { PRACTICE_MODE_LABELS } from '../constants';
import type { ScreenId, ScriptSource, SessionRecord } from '../types';
import {
  createButton,
  createErrorArea,
  formatDurationSec,
  renderErrorMessage,
} from './screenParts';

// SCR-04 結果(要件定義書 5.1)
// appState.record の練習記録を出す。練習の直後と、履歴から開いたときの両方でここを通る

/** 結果画面を描く */
export function renderResultScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const errorArea = createErrorArea();
  const record = appState.record;

  const heading = document.createElement('h1');
  heading.textContent = '練習の結果';
  container.append(heading, errorArea);

  // 練習直後に保存できなかった場合だけ出す
  if (appState.isSaveFailed) {
    renderErrorMessage(errorArea, 'storage-failed');
    appState.isSaveFailed = false;
  }

  if (record === null) {
    const message = document.createElement('p');
    message.textContent = '表示する練習記録がありません。';
    container.append(
      message,
      createButton('ホームへ', () => showScreen('home')),
    );
    return;
  }

  /**
   * 「もう一度練習」が押されたとき(同じモード・同じ台本): SCR-01
   * ホーム画面に同じモードと台本を入れて戻る。練習はホーム画面の「開始」で始める
   */
  const handleRetryClick = (): void => {
    const script: ScriptSource | null =
      record.scriptText === null
        ? null
        : { title: record.scriptTitle ?? '', text: record.scriptText };
    appState.mode = record.mode;
    appState.script = script;
    showScreen('home');
  };

  container.append(createSummaryList(record));

  // 台本があるモードでは一致度と、台本との違いの色分けを出す(F-06)
  // 履歴から開いたときも、保存してある台本と文字起こしから作り直す(F-08)
  if (record.scriptText !== null) {
    container.append(createDiffSection(record.scriptText, record.transcript));
  }

  const transcriptHeading = document.createElement('h2');
  transcriptHeading.textContent = '文字起こし全文';
  const transcriptElement = document.createElement('p');
  transcriptElement.className = 'transcript';
  transcriptElement.textContent = record.transcript || '(文字起こしはありません)';

  const retryButton = createButton('もう一度練習', handleRetryClick);
  retryButton.classList.add('button-primary');
  const actions = document.createElement('div');
  actions.className = 'page-actions';
  actions.append(
    retryButton,
    createButton('履歴を見る', () => showScreen('history')),
    createButton('ホームへ', () => showScreen('home')),
  );

  container.append(transcriptHeading, transcriptElement, actions);
}

/** 練習モード、練習時間、平均の速さ、最適だった時間の割合、一致度の一覧を作る */
function createSummaryList(record: SessionRecord): HTMLDListElement {
  const items: [string, string][] = [
    ['練習モード', PRACTICE_MODE_LABELS[record.mode]],
    ['練習時間', formatDurationSec(record.durationSec)],
    ['平均の速さ', `${Math.round(record.averageCpm)} 文字/分`],
    ['速さが最適だった時間の割合', `${Math.round(record.speedOptimalRatio * 100)}%`],
  ];
  if (record.scriptText !== null) {
    items.unshift(['台本', record.scriptTitle ?? '']);
    items.push(['一致度', record.matchRate === null ? '—' : `${record.matchRate}%`]);
  }

  const list = document.createElement('dl');
  list.className = 'summary';
  for (const [term, value] of items) {
    const termElement = document.createElement('dt');
    termElement.textContent = term;
    const valueElement = document.createElement('dd');
    valueElement.textContent = value;
    list.append(termElement, valueElement);
  }
  return list;
}

/** 台本との違いの色分け表示を作る。色や線の付け方は【未決定】(style.css の .diff-〇〇) */
function createDiffSection(scriptText: string, transcript: string): HTMLElement {
  const section = document.createElement('section');
  const sectionHeading = document.createElement('h2');
  sectionHeading.textContent = '台本との違い';

  const legend = document.createElement('p');
  legend.className = 'diff-legend';
  legend.innerHTML =
    '<span class="diff-match">台本どおり</span> ' +
    '<span class="diff-missing">読み飛ばし・誤認識</span> ' +
    '<span class="diff-extra">台本にない言葉</span>';

  const diffElement = document.createElement('p');
  diffElement.className = 'script-text';
  const { segments } = compareWithScript(scriptText, transcript);
  if (segments.length === 0) {
    diffElement.textContent = '(違いの表示はありません)';
  }
  for (const segment of segments) {
    const span = document.createElement('span');
    span.className = `diff-${segment.type}`;
    span.textContent = segment.text;
    diffElement.append(span);
  }

  section.append(sectionHeading, legend, diffElement);
  return section;
}
