import './style.css';
import type { ScreenId } from './types';
import { renderHomeScreen } from './screens/homeScreen';
import { renderScriptScreen } from './screens/scriptScreen';
import { renderPracticeScreen } from './screens/practiceScreen';
import { renderResultScreen } from './screens/resultScreen';
import { renderHistoryScreen } from './screens/historyScreen';

// 起動処理と画面の切り替え

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) {
  throw new Error('#app が見つかりません');
}
const app: HTMLDivElement = appElement;

// 画面を描く関数。showScreen を受け取り、ボタンが押されたら別の画面に切り替える
type ScreenRenderer = (container: HTMLElement, showScreen: (screenId: ScreenId) => void) => void;

const screenRenderers: Record<ScreenId, ScreenRenderer> = {
  home: renderHomeScreen,
  script: renderScriptScreen,
  practice: renderPracticeScreen,
  result: renderResultScreen,
  history: renderHistoryScreen,
};

/** 画面を切り替える */
export function showScreen(screenId: ScreenId): void {
  app.replaceChildren();
  screenRenderers[screenId](app, showScreen);
}

showScreen('home');
