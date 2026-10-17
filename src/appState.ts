import type { PracticeMode, ScriptSource, SessionRecord } from './types';

// 画面をまたいで受け渡すデータ
// 画面を切り替える前にここへ入れ、切り替えた先の画面で読む
export interface AppState {
  mode: PracticeMode | null; // 選んだ練習モード
  script: ScriptSource | null; // 練習で使う台本。台本なしは null
  record: SessionRecord | null; // 結果画面に出す練習記録
  isSaveFailed: boolean; // 直前の練習記録を保存できなかったか(結果画面で 'storage-failed' を出す)
}

export const appState: AppState = {
  mode: 'free', // 起動時は台本なしモードで始める
  script: null,
  record: null,
  isSaveFailed: false,
};
