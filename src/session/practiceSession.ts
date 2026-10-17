import { judgeSpeed } from '../analysis/judge';
import { calculateMatchRate } from '../analysis/scriptMatcher';
import { calculateCpm, countCharacters } from '../analysis/speedCalculator';
import { SPEED_WINDOW_SEC } from '../constants';
import { SpeechRecognizer } from '../speech/speechRecognizer';
import type {
  AppErrorCode,
  MeasurementSample,
  PracticeMode,
  ScriptSource,
  SessionRecord,
} from '../types';

// 練習の開始・終了・集計(F-02, F-07)

/** 直近の対象期間(SPEED_WINDOW_SEC)の文字数差分を求めるための記録 */
interface CharCountSnapshot {
  elapsedSec: number;
  charCount: number;
}

/** 音声認識インスタンス(F-02, F-03, F-07 で共有する) */
const recognizer = new SpeechRecognizer();

/** 現在進行中の練習モード */
let currentMode: PracticeMode = 'free';

/** 現在進行中の台本(台本なしモードでは null) */
let currentScript: ScriptSource | null = null;

/** 練習開始時刻(ミリ秒) */
let startedAtMs: number | null = null;

/** 練習開始日時(ISO 8601形式) */
let startedAtIso: string | null = null;

/** 練習中に記録された計測サンプル一覧 */
let sessionSamples: MeasurementSample[] = [];

/** 経過秒ごとの累計文字数の履歴(F-04) */
let charCountSnapshots: CharCountSnapshot[] = [];

/** 練習中かどうか */
let isRunning = false;

/** 取得したマイクの MediaStream(終了時に解放する) */
let mediaStream: MediaStream | null = null;

/** 確定済みの文字起こしテキスト(F-03) */
let confirmedTranscript = '';

/** 認識途中の文字起こしテキスト(F-03) */
let interimTranscript = '';

/** 練習中に起きたエラーを受け取るコールバック関数(F-03) */
let sessionErrorCallback: ((code: AppErrorCode) => void) | null = null;

/** 音声認識の結果を受け取り、確定分と途中結果分を更新する(F-03) */
function handleRecognitionResult(transcript: string, isFinal: boolean): void {
  if (isFinal) {
    confirmedTranscript += transcript;
    interimTranscript = '';
  } else {
    interimTranscript = transcript;
  }
}

/** 練習中に発生した音声認識エラーを通知する(F-03) */
function handleRecognitionError(code: AppErrorCode): void {
  sessionErrorCallback?.(code);
}

/** getUserMedia の例外を AppErrorCode に変換する */
function mapMediaErrorToCode(error: unknown): AppErrorCode {
  if (typeof error === 'string') {
    if (
      error === 'mic-denied' ||
      error === 'mic-not-found' ||
      error === 'speech-unsupported' ||
      error === 'speech-network'
    ) {
      return error;
    }
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const errorName = String((error as { name: unknown }).name);
    if (
      errorName === 'NotFoundError' ||
      errorName === 'DevicesNotFoundError' ||
      errorName === 'OverconstrainedError'
    ) {
      return 'mic-not-found';
    }
    if (
      errorName === 'NotAllowedError' ||
      errorName === 'PermissionDeniedError' ||
      errorName === 'SecurityError'
    ) {
      return 'mic-denied';
    }
  }
  return 'mic-denied';
}

/** 保持しているマイクストリームを解放する */
function releaseMediaStream(): void {
  if (mediaStream === null) {
    return;
  }
  for (const track of mediaStream.getTracks()) {
    track.stop();
  }
  mediaStream = null;
}

/**
 * 認識と計測を始める。
 * 始められなかったときは AppErrorCode('mic-denied' など)で reject する
 */
export async function startSession(mode: PracticeMode, script: ScriptSource | null): Promise<void> {
  if (isRunning) {
    recognizer.stop();
    releaseMediaStream();
    isRunning = false;
  }

  if (!recognizer.isSupported()) {
    return Promise.reject('speech-unsupported' satisfies AppErrorCode);
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  ) {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error: unknown) {
      releaseMediaStream();
      return Promise.reject(mapMediaErrorToCode(error));
    }
    // マイクの許可と接続を確かめるためだけに開く。音声認識はブラウザが別にマイクを使う。
    // 開いたままにすると、ブラウザの自動音量調整がマイクの音量を変えて認識に響くことがあるので、すぐ閉じる
    releaseMediaStream();
  }

  let startupError: AppErrorCode | null = null;
  recognizer.onResult(handleRecognitionResult);
  recognizer.onError((code: AppErrorCode): void => {
    startupError = code;
  });

  currentMode = mode;
  currentScript = mode === 'free' ? null : script;
  startedAtMs = Date.now();
  startedAtIso = new Date(startedAtMs).toISOString();
  sessionSamples = [];
  charCountSnapshots = [{ elapsedSec: 0, charCount: 0 }];
  confirmedTranscript = '';
  interimTranscript = '';
  isRunning = true;

  recognizer.start();

  if (startupError !== null) {
    recognizer.stop();
    releaseMediaStream();
    isRunning = false;
    return Promise.reject(startupError);
  }

  recognizer.onError(handleRecognitionError);
}

/** 認識と計測を止め、一致度を計算して記録を返す */
export function stopSession(): SessionRecord {
  recognizer.stop();
  releaseMediaStream();
  isRunning = false;

  const transcript = getTranscript();
  const record = buildSessionRecord(sessionSamples, transcript);

  startedAtMs = null;
  startedAtIso = null;
  sessionSamples = [];
  charCountSnapshots = [];
  confirmedTranscript = '';
  interimTranscript = '';

  return record;
}

/** JUDGE_INTERVAL_MS ごとに呼ばれ、計測と判定を1回行う */
export function updateJudgement(): MeasurementSample {
  const nowMs = Date.now();
  const elapsedSec = startedAtMs !== null ? Math.max(0, (nowMs - startedAtMs) / 1000) : 0;
  const charCount = countCharacters(getTranscript());

  let windowCharCount = charCount;
  let windowSec = elapsedSec;

  if (elapsedSec > SPEED_WINDOW_SEC && charCountSnapshots.length > 0) {
    const windowStartSec = elapsedSec - SPEED_WINDOW_SEC;
    let baseSnapshot: CharCountSnapshot = charCountSnapshots[0] ?? { elapsedSec: 0, charCount: 0 };
    for (const snapshot of charCountSnapshots) {
      if (snapshot.elapsedSec <= windowStartSec) {
        baseSnapshot = snapshot;
      } else {
        break;
      }
    }
    windowCharCount = Math.max(0, charCount - baseSnapshot.charCount);
    windowSec = elapsedSec - baseSnapshot.elapsedSec;
  }

  // TODO【未決定】: 黙っているあいだの速さの判定は未決定(要件定義書 4.1)。仮実装としてそのまま計算を続ける
  const cpm = calculateCpm(windowCharCount, windowSec);
  const speedLevel = judgeSpeed(cpm);

  charCountSnapshots.push({ elapsedSec, charCount });

  const sample: MeasurementSample = { elapsedSec, cpm, speedLevel };
  sessionSamples.push(sample);
  return sample;
}

/** 平均値と割合を集計する */
export function buildSessionRecord(
  samples: MeasurementSample[],
  transcript: string,
): SessionRecord {
  const nowMs = Date.now();
  const startedAt = startedAtIso ?? new Date(nowMs).toISOString();

  const elapsedFromStartSec = startedAtMs !== null ? Math.max(0, (nowMs - startedAtMs) / 1000) : 0;
  const lastSampleElapsedSec =
    samples.length > 0 ? (samples[samples.length - 1]?.elapsedSec ?? 0) : 0;
  const durationSec = Math.round(Math.max(elapsedFromStartSec, lastSampleElapsedSec));

  const charCount = countCharacters(transcript);
  // TODO【未決定】: 結果画面の平均速度から黙っていた時間を除くかは未決定(要件定義書 4.1)。仮実装として練習全体の文字数 ÷ 練習時間で計算する
  const averageCpm = durationSec > 0 ? calculateCpm(charCount, durationSec) : 0;

  const optimalCount = samples.filter((sample) => sample.speedLevel === 'optimal').length;
  const speedOptimalRatio = samples.length > 0 ? optimalCount / samples.length : 0;

  const activeScript = currentMode === 'free' ? null : currentScript;
  const scriptTitle = activeScript !== null ? activeScript.title : null;
  const scriptText = activeScript !== null ? activeScript.text : null;
  const matchRate = scriptText !== null ? calculateMatchRate(scriptText, transcript) : null;

  // TODO【未決定】: 計測値の明細(samples)を保存するかは未決定(要件定義書 7章)。仮実装として含めている
  return {
    id: crypto.randomUUID(),
    startedAt,
    mode: currentMode,
    scriptTitle,
    scriptText,
    durationSec,
    transcript,
    charCount,
    averageCpm,
    speedOptimalRatio,
    matchRate,
    samples: [...samples],
  };
}

/** 練習中の文字起こし全文を返す(練習画面に出す) */
export function getTranscript(): string {
  return confirmedTranscript + interimTranscript;
}

/** 練習中に起きたエラー('speech-network' など)を受け取る関数を登録する */
export function onSessionError(callback: (code: AppErrorCode) => void): void {
  sessionErrorCallback = callback;
}
