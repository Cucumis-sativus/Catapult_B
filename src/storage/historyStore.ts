import type { SessionRecord } from '../types';
import { MAX_HISTORY_COUNT, STORAGE_KEY } from '../constants';

// 履歴の保存・読み込み・削除（F-07、F-08、F-09）

/** 記録を1件保存する。上限を超えたら古いものから削除する */
export function saveSession(record: SessionRecord): void {
  const records = loadSessions();

  // 同じIDの記録があれば重複を防ぐ
  const filteredRecords = records.filter((savedRecord) => savedRecord.id !== record.id);

  // 新しい記録を先頭に追加し、保存件数の上限を適用する
  const updatedRecords = [record, ...filteredRecords].slice(0, MAX_HISTORY_COUNT);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch {
    throw new Error('履歴を保存できませんでした。');
  }
}

/** 全件を新しい順で返す */
export function loadSessions(): SessionRecord[] {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (savedData === null) {
      return [];
    }

    const records: SessionRecord[] = JSON.parse(savedData);

    if (!Array.isArray(records)) {
      throw new Error('履歴データの形式が正しくありません。');
    }

    return records.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  } catch {
    throw new Error('履歴を読み込めませんでした。');
  }
}

/** 記録を1件削除する */
export function deleteSession(id: string): void {
  const records = loadSessions();
  const updatedRecords = records.filter((record) => record.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
  } catch {
    throw new Error('履歴を削除できませんでした。');
  }
}
