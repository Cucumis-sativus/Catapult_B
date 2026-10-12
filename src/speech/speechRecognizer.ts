import type { AppErrorCode } from '../types';

// 音声認識(F-03)
// Web Speech API で日本語(SPEECH_LANG)を連続認識する。途中結果と確定結果を受け取り、
// 認識が自動で止まったら再開する。エラーは AppErrorCode に直して onError の関数に渡す
export class SpeechRecognizer {
  /** 認識を始める */
  start(): void {
    // TODO(F-03): 未実装
  }

  /** 認識を止める */
  stop(): void {
    // TODO(F-03): 未実装
  }

  /** 認識結果を受け取る関数を登録する */
  onResult(callback: (transcript: string, isFinal: boolean) => void): void {
    // TODO(F-03): 未実装
  }

  /** エラーを受け取る関数を登録する */
  onError(callback: (code: AppErrorCode) => void): void {
    // TODO(F-03): 未実装
  }

  /** ブラウザが音声認識に対応しているかを返す */
  isSupported(): boolean {
    // TODO(F-03): 未実装。仮の値を返している
    return false;
  }
}
