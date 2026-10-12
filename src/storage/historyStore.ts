import type { SessionRecord } from '../types';

// 履歴の保存・読み込み・削除(F-08, F-09、要件定義書 7章)
// localStorage の STORAGE_KEY に JSON 配列として保存する
// 保存できなかったときは例外を投げる(画面側で 'storage-failed' を出す)

/** 記録を1件保存する。MAX_HISTORY_COUNT を超えたら古いものから消す */
export function saveSession(record: SessionRecord): void {
  // TODO(F-07): 未実装
}

/** 全件を新しい順で返す */
export function loadSessions(): SessionRecord[] {
  // TODO(F-08): 未実装。仮の値を返している
  return [];
}

/** 記録を1件消す */
export function deleteSession(id: string): void {
  // TODO(F-09): 未実装
}
