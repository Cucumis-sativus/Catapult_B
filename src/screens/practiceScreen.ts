import { getAudienceSpriteKey } from '../analysis/judge';
import { appState } from '../appState';
import { AudienceView } from '../audience/audienceView';
import { JUDGE_INTERVAL_MS, PRACTICE_MODE_LABELS, SPEED_LEVEL_LABELS } from '../constants';
import { onSessionError, stopSession, updateJudgement } from '../session/practiceSession';
import { saveSession } from '../storage/historyStore';
import type { PracticeMode, ScreenId } from '../types';
import {
  createButton,
  createErrorArea,
  createScriptPanel,
  formatDurationSec,
  renderErrorMessage,
} from './screenParts';

// SCR-03 練習(要件定義書 5.1)
// ホーム画面と同じ配置で、「開始」の場所に「終了」を出す
// 文字起こし(F-03)は練習中には出さず、裏側で持っておいて結果画面にだけ出す
// 一時停止ボタン、台本を隠す切り替えの要否は【未決定】

/** 練習画面を描く */
export function renderPracticeScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const mode: PracticeMode = appState.mode ?? 'free';
  const errorArea = createErrorArea();
  onSessionError((code) => renderErrorMessage(errorArea, code));

  const stage = document.createElement('div');
  stage.className = 'stage is-running';

  // 背景と観客スプライト(F-05)。最初の判定が出るまでは通常の観客を出す
  const scene = document.createElement('div');
  scene.className = 'stage-scene';
  const audienceView = new AudienceView(scene);
  void audienceView.loadSprites();

  // 左上: 練習中の印、経過時間、練習モード
  const status = document.createElement('div');
  status.className = 'stage-status';
  const recordingElement = document.createElement('p');
  recordingElement.className = 'recording-indicator';
  recordingElement.textContent = '練習中';
  const elapsedElement = document.createElement('p');
  elapsedElement.className = 'elapsed-time';
  const elapsedValueElement = document.createElement('span');
  elapsedValueElement.textContent = formatDurationSec(0);
  elapsedElement.append(createLabel('elapsed-label', '経過時間'), elapsedValueElement);
  status.append(
    recordingElement,
    elapsedElement,
    createLabel('mode-chip', PRACTICE_MODE_LABELS[mode], 'p'),
  );

  // 上の中央: 現在の速さと判定(F-04)。話しながらでも読めるよう大きく出す(9章 使用性)
  // 判定が出る前の表示は【未決定】。いまは「—」を出している
  const speedMeter = document.createElement('div');
  speedMeter.className = 'speed-meter';
  const cpmElement = document.createElement('p');
  cpmElement.className = 'speed-value';
  const cpmValueElement = document.createElement('span');
  cpmValueElement.textContent = '—';
  cpmElement.append(cpmValueElement, createLabel('speed-unit', '文字/分'));
  const speedLevelElement = document.createElement('p');
  speedLevelElement.className = 'speed-level';
  speedLevelElement.textContent = '—';
  speedMeter.append(cpmElement, speedLevelElement);

  // JUDGE_INTERVAL_MS ごとに計測と判定をして、表示と観客を更新する(F-03〜F-05)
  const judgeTimerId = window.setInterval(() => {
    const sample = updateJudgement();
    cpmValueElement.textContent = String(Math.round(sample.cpm));
    speedLevelElement.textContent = SPEED_LEVEL_LABELS[sample.speedLevel];
    speedLevelElement.dataset.speedLevel = sample.speedLevel;
    elapsedValueElement.textContent = formatDurationSec(sample.elapsedSec);
    audienceView.setSprite(getAudienceSpriteKey(sample.speedLevel));
  }, JUDGE_INTERVAL_MS);

  /** 「終了」が押されたとき: F-06、F-07 → SCR-04 */
  const handleStopClick = (): void => {
    window.clearInterval(judgeTimerId);
    const record = stopSession();
    try {
      saveSession(record);
      appState.isSaveFailed = false;
    } catch {
      appState.isSaveFailed = true;
    }
    appState.record = record;
    showScreen('result');
  };

  // 下の中央: 台本(あるモードだけ)と「終了」ボタン
  const controls = document.createElement('div');
  controls.className = 'stage-controls';
  if (appState.script !== null) {
    controls.append(createScriptPanel(appState.script));
  }
  const stopButton = createButton('終了', handleStopClick);
  stopButton.classList.add('stage-button', 'stage-button-stop');
  controls.append(errorArea, stopButton);

  stage.append(scene, status, speedMeter, controls);
  container.append(stage);
}

/** class と文字だけを持つ小さな要素を作る */
function createLabel(className: string, text: string, tagName: 'span' | 'p' = 'span'): HTMLElement {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}
