import { SPEECH_LANG } from '../constants';
import type { AppErrorCode } from '../types';

/** Web Speech API の認識結果1件分の型 */
interface SpeechRecognitionAlternativeItem {
  readonly transcript: string;
}

/** Web Speech API の認識結果要素の型 */
interface SpeechRecognitionResultItem {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeItem;
}

/** Web Speech API の認識結果リストの型 */
interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultItem;
}

/** Web Speech API の result イベントの型 */
interface SpeechRecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

/** Web Speech API の error イベントの型 */
interface SpeechRecognitionErrorEventItem {
  readonly error: string;
}

/** Web Speech API の SpeechRecognition インスタンスの型 */
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventItem) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/** SpeechRecognition コンストラクタの型 */
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

/** window オブジェクトの拡張型 */
interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/** 認識結果を受け取るコールバック関数の型 */
type ResultCallback = (transcript: string, isFinal: boolean) => void;

/** エラーを受け取るコールバック関数の型 */
type ErrorCallback = (code: AppErrorCode) => void;

/** ブラウザの SpeechRecognition コンストラクタを取得する */
function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const speechWindow = window as unknown as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

/** Web Speech API のエラー名を AppErrorCode に変換する */
function mapErrorCode(error: string): AppErrorCode | null {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'mic-denied';
    case 'audio-capture':
      return 'mic-not-found';
    case 'network':
      return 'speech-network';
    default:
      return null;
  }
}

// 音声認識(F-03)
// Web Speech API で日本語(SPEECH_LANG)を連続認識する。途中結果と確定結果を受け取り、
// 認識が自動で止まったら再開する。エラーは AppErrorCode に直して onError の関数に渡す
// 途中結果はブラウザが複数のかたまりに分けて返すことがあるので、つなげて1つにして渡す
export class SpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private isRunning: boolean = false;
  private resultCallback: ResultCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  /** まだ確定していない途中結果。確定する前に認識が止まったときに確定として渡す */
  private pendingInterimTranscript: string = '';

  /** 認識を始める */
  start(): void {
    const RecognitionConstructor = getSpeechRecognitionConstructor();
    if (!RecognitionConstructor) {
      this.errorCallback?.('speech-unsupported');
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.pendingInterimTranscript = '';
    this.recognition = this.createRecognition(RecognitionConstructor);
    this.startRecognition();
  }

  /** 認識を止める */
  stop(): void {
    this.isRunning = false;
    this.pendingInterimTranscript = '';
    if (!this.recognition) {
      return;
    }

    const currentRecognition = this.recognition;
    this.recognition = null;
    try {
      currentRecognition.stop();
    } catch {
      // すでに停止している場合の例外は無視する
    }
  }

  /** 認識結果を受け取る関数を登録する */
  onResult(callback: (transcript: string, isFinal: boolean) => void): void {
    this.resultCallback = callback;
  }

  /** エラーを受け取る関数を登録する */
  onError(callback: (code: AppErrorCode) => void): void {
    this.errorCallback = callback;
  }

  /** ブラウザが音声認識に対応しているかを返す */
  isSupported(): boolean {
    return getSpeechRecognitionConstructor() !== null;
  }

  /** SpeechRecognition インスタンスを生成してイベントを設定する */
  private createRecognition(
    RecognitionConstructor: SpeechRecognitionConstructor,
  ): SpeechRecognitionInstance {
    const recognition = new RecognitionConstructor();
    recognition.lang = SPEECH_LANG;
    recognition.continuous = true;
    recognition.interimResults = true;

    // stop() したあとに届いたイベントは使わない(次の練習に前の結果が混ざらないようにする)
    recognition.onresult = (event: SpeechRecognitionResultEvent): void => {
      if (recognition === this.recognition) {
        this.handleResult(event);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventItem): void => {
      if (recognition === this.recognition) {
        this.handleError(event);
      }
    };

    recognition.onend = (): void => {
      if (recognition === this.recognition) {
        this.handleEnd();
      }
    };

    return recognition;
  }

  /** SpeechRecognition の開始処理を実行する */
  private startRecognition(): void {
    if (!this.isRunning || !this.recognition) {
      return;
    }

    try {
      this.recognition.start();
    } catch {
      // すでに開始されている場合などの例外は無視する
    }
  }

  /**
   * 認識結果イベントを処理する。
   * event.results には、この認識で出た結果がすべて入っている。確定した結果は変わらないので、
   * 新しく確定したもの(resultIndex 以降)だけを1件ずつ渡す。
   * 途中結果は複数のかたまりに分かれて届き、変わったかたまりだけが resultIndex 以降に来ることもある。
   * そのため全件からつなげ直し、いまの途中結果の全体として1回渡す
   */
  private handleResult(event: SpeechRecognitionResultEvent): void {
    if (!this.resultCallback) {
      return;
    }

    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result && result.length > 0 ? result[0]?.transcript : undefined;
      if (!result || transcript === undefined) {
        continue;
      }
      if (!result.isFinal) {
        interimTranscript += transcript;
      } else if (i >= event.resultIndex) {
        this.resultCallback(transcript, true);
      }
    }

    this.pendingInterimTranscript = interimTranscript;
    this.resultCallback(interimTranscript, false);
  }

  /** エラーイベントを処理する */
  private handleError(event: SpeechRecognitionErrorEventItem): void {
    const code = mapErrorCode(event.error);
    if (!code) {
      // 'no-speech' や 'aborted' などはエラー通知せず、自動再開に任せる
      return;
    }

    // 継続不能なエラーの場合は自動再開を止めて通知する
    this.isRunning = false;
    this.errorCallback?.(code);
  }

  /** 認識終了イベントを処理し、練習中であれば自動再開する */
  private handleEnd(): void {
    if (!this.isRunning) {
      return;
    }

    // 確定する前に止まった途中結果は、再開すると消えてしまうので確定として渡しておく
    if (this.pendingInterimTranscript !== '') {
      const transcript = this.pendingInterimTranscript;
      this.pendingInterimTranscript = '';
      this.resultCallback?.(transcript, true);
    }

    this.startRecognition();
  }
}
