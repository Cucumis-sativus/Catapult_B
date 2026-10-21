import { judgeSpeed } from '../analysis/judge';
import { calculateMatchRate } from '../analysis/scriptMatcher';
import { calculateCpm, countCharacters } from '../analysis/speedCalculator';
import { SPEED_SILENCE_SEC, SPEED_WINDOW_SEC } from '../constants';
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
  speakingSec: number; // 黙っていた時間を除いた経過秒
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

/** 前回の判定時の経過秒(F-04) */
let lastJudgedElapsedSec = 0;

/** これまでで最も多かった文字数(F-04)。途中結果の書き換えで減っても、話したことにはしない */
let maxCharCount = 0;

/** 最後に文字が増えたときの経過秒(F-04) */
let lastCharIncreaseSec = 0;

/** 黙っていた時間の合計(秒)(F-04) */
let silentSec = 0;

/** 最後に判定した計測サンプル(F-04)。黙っているあいだはこの判定を保つ */
let lastSample: MeasurementSample | null = null;

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
  charCountSnapshots = [{ speakingSec: 0, charCount: 0 }];
  resetSilenceState();
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
  resetSilenceState();
  confirmedTranscript = '';
  interimTranscript = '';

  return record;
}

/** 黙っている時間の計測に使う状態を初期化する(F-04) */
function resetSilenceState(): void {
  lastJudgedElapsedSec = 0;
  maxCharCount = 0;
  lastCharIncreaseSec = 0;
  silentSec = 0;
  lastSample = null;
}

/**
 * JUDGE_INTERVAL_MS ごとに呼ばれ、計測と判定を1回行う。
 * 文字が増えないまま SPEED_SILENCE_SEC 秒たったら黙っているとみなし、直前の判定を保つ(4.1)
 */
export function updateJudgement(): MeasurementSample {
  const nowMs = Date.now();
  const elapsedSec = startedAtMs !== null ? Math.max(0, (nowMs - startedAtMs) / 1000) : 0;
  const charCount = countCharacters(getTranscript());

  if (charCount > maxCharCount) {
    maxCharCount = charCount;
    lastCharIncreaseSec = elapsedSec;
  } else {
    // 前回の判定から今回までのうち、最後に文字が増えてから SPEED_SILENCE_SEC 秒を過ぎた分を黙っていた時間に足す
    const silenceStartSec = Math.max(lastJudgedElapsedSec, lastCharIncreaseSec + SPEED_SILENCE_SEC);
    silentSec += Math.max(0, elapsedSec - silenceStartSec);
  }
  lastJudgedElapsedSec = elapsedSec;

  const speakingSec = elapsedSec - silentSec;
  charCountSnapshots.push({ speakingSec, charCount });

  const isSilent = elapsedSec - lastCharIncreaseSec >= SPEED_SILENCE_SEC;
  if (isSilent) {
    // 黙っているあいだの計測は記録に残さない。最適の割合も話していた時間だけで出す
    // TODO【未決定】: 話し始める前(判定前)の表示は未決定(要件定義書 4.3)。仮実装として 0 文字/分の判定を返す
    return {
      elapsedSec,
      cpm: lastSample?.cpm ?? 0,
      speedLevel: lastSample?.speedLevel ?? judgeSpeed(0),
    };
  }

  // 対象期間は黙っていた時間を除いて数える。間を取ったあと話し始めても「遅い」に引きずられない
  const windowStartSec = speakingSec - SPEED_WINDOW_SEC;
  let baseSnapshot: CharCountSnapshot = charCountSnapshots[0] ?? { speakingSec: 0, charCount: 0 };
  for (const snapshot of charCountSnapshots) {
    if (snapshot.speakingSec <= windowStartSec) {
      baseSnapshot = snapshot;
    } else {
      break;
    }
  }
  const windowCharCount = Math.max(0, charCount - baseSnapshot.charCount);
  const windowSec = speakingSec - baseSnapshot.speakingSec;

  const cpm = calculateCpm(windowCharCount, windowSec);
  const speedLevel = judgeSpeed(cpm);

  const sample: MeasurementSample = { elapsedSec, cpm, speedLevel };
  sessionSamples.push(sample);
  lastSample = sample;
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
  // 平均速度は黙っていた時間を除いて計算する(4.1)
  const speakingSec = Math.max(0, durationSec - silentSec);
  const averageCpm = speakingSec > 0 ? calculateCpm(charCount, speakingSec) : 0;

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
