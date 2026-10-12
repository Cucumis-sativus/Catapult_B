import { getAudienceSpriteKey } from '../analysis/judge';
import { appState } from '../appState';
import { AudienceView } from '../audience/audienceView';
import { JUDGE_INTERVAL_MS, PRACTICE_MODE_LABELS, SPEED_LEVEL_LABELS } from '../constants';
import {
  getTranscript,
  onSessionError,
  stopSession,
  updateJudgement,
} from '../session/practiceSession';
import { saveSession } from '../storage/historyStore';
import type { ScreenId } from '../types';
import {
  createButton,
  createErrorArea,
  formatDurationSec,
  renderErrorMessage,
} from './screenParts';

// SCR-03 練習(要件定義書 5.1)
// 一時停止ボタン、台本を隠す切り替えの要否は【未決定】

/** 練習画面を描く */
export function renderPracticeScreen(
  container: HTMLElement,
  showScreen: (screenId: ScreenId) => void,
): void {
  const errorArea = createErrorArea();
  onSessionError((code) => renderErrorMessage(errorArea, code));

  const heading = document.createElement('h1');
  heading.textContent = appState.mode ? `練習中(${PRACTICE_MODE_LABELS[appState.mode]})` : '練習中';

  // 観客スプライト(F-05)
  const audienceArea = document.createElement('div');
  audienceArea.className = 'audience';
  const audienceView = new AudienceView(audienceArea);
  void audienceView.loadSprites();

  // 現在の速さと判定、経過時間(F-04)
  // 判定が出る前の表示は【未決定】。いまは「—」を出している
  const cpmElement = document.createElement('p');
  cpmElement.className = 'speed-value';
  cpmElement.textContent = '— 文字/分';
  const speedLevelElement = document.createElement('p');
  speedLevelElement.className = 'speed-level';
  speedLevelElement.textContent = '—';
  const elapsedElement = document.createElement('p');
  elapsedElement.textContent = `経過時間 ${formatDurationSec(0)}`;

  // 文字起こし(F-03)
  const transcriptHeading = document.createElement('h2');
  transcriptHeading.textContent = '文字起こし';
  const transcriptElement = document.createElement('p');
  transcriptElement.className = 'transcript';

  // JUDGE_INTERVAL_MS ごとに計測と判定をして、表示と観客を更新する(F-03〜F-05)
  const judgeTimerId = window.setInterval(() => {
    const sample = updateJudgement();
    cpmElement.textContent = `${Math.round(sample.cpm)} 文字/分`;
    speedLevelElement.textContent = SPEED_LEVEL_LABELS[sample.speedLevel];
    speedLevelElement.dataset.speedLevel = sample.speedLevel;
    elapsedElement.textContent = `経過時間 ${formatDurationSec(sample.elapsedSec)}`;
    audienceView.setSprite(getAudienceSpriteKey(sample.speedLevel));
    transcriptElement.textContent = getTranscript();
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

  container.append(heading, audienceArea, cpmElement, speedLevelElement, elapsedElement);

  // 台本があるモードでは台本の本文も出す
  if (appState.script !== null) {
    const scriptHeading = document.createElement('h2');
    scriptHeading.textContent = appState.script.title;
    const scriptTextElement = document.createElement('p');
    scriptTextElement.className = 'script-text';
    scriptTextElement.textContent = appState.script.text;
    container.append(scriptHeading, scriptTextElement);
  }

  container.append(
    transcriptHeading,
    transcriptElement,
    errorArea,
    createButton('終了', handleStopClick),
  );
}
