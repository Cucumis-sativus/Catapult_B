import { appState } from '../appState';
import { PRACTICE_MODE_LABELS } from '../constants';
import { deleteSession, loadSessions } from '../storage/historyStore';
import type { ScreenId, SessionRecord } from '../types';
import {
  createButton,
  createErrorArea,
  formatDurationSec,
  renderErrorMessage,
} from './screenParts';

// SCR-05 履歴(要件定義書 5.1)

/** 履歴画面を描く */
export function renderHistoryScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const errorArea = createErrorArea();

  const heading = document.createElement('h1');
  heading.textContent = '練習の履歴';
  container.append(heading, errorArea);

  // F-08: 新しい順に読み込む
  let records: SessionRecord[] = [];
  try {
    records = loadSessions();
  } catch {
    renderErrorMessage(errorArea, 'storage-failed');
  }

  /** 行が選ばれたとき: F-08 → SCR-04 */
  const handleRowSelect = (record: SessionRecord): void => {
    appState.record = record;
    appState.isSaveFailed = false;
    showScreen('result');
  };

  /** 「削除」が押されたとき: F-09 → 同じ画面。削除前の確認は【未決定】 */
  const handleDeleteClick = (record: SessionRecord): void => {
    try {
      deleteSession(record.id);
    } catch {
      renderErrorMessage(errorArea, 'storage-failed');
      return;
    }
    showScreen('history');
  };

  if (records.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'まだ練習の記録がありません。';
    container.append(message);
  } else {
    container.append(createHistoryTable(records, handleRowSelect, handleDeleteClick));
  }

  container.append(createButton('ホームへ', () => showScreen('home')));
}

/** 履歴の一覧表を作る(日時、モード、台本のタイトル、練習時間、平均の速さ、一致度) */
function createHistoryTable(
  records: SessionRecord[],
  onSelect: (record: SessionRecord) => void,
  onDelete: (record: SessionRecord) => void,
): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>日時</th><th>モード</th><th>台本</th><th>練習時間</th><th>平均の速さ</th><th>一致度</th><th></th>
      </tr>
    </thead>
  `;

  const body = document.createElement('tbody');
  for (const record of records) {
    const row = document.createElement('tr');
    row.tabIndex = 0;
    const cells = [
      new Date(record.startedAt).toLocaleString('ja-JP'),
      PRACTICE_MODE_LABELS[record.mode],
      record.scriptTitle ?? '—',
      formatDurationSec(record.durationSec),
      `${Math.round(record.averageCpm)} 文字/分`,
      record.matchRate === null ? '—' : `${record.matchRate}%`,
    ];
    for (const text of cells) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }

    const deleteCell = document.createElement('td');
    const deleteButton = createButton('削除', () => onDelete(record));
    // 削除ボタンを押したときに、行の選択まで動かないようにする
    deleteButton.addEventListener('click', (event) => event.stopPropagation());
    deleteCell.append(deleteButton);
    row.append(deleteCell);

    row.addEventListener('click', () => onSelect(record));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        onSelect(record);
      }
    });
    body.append(row);
  }
  table.append(body);
  return table;
}
