import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as scriptMatcher from '../analysis/scriptMatcher';
import * as speedCalculator from '../analysis/speedCalculator';
import { SpeechRecognizer } from '../speech/speechRecognizer';
import type { AppErrorCode, MeasurementSample } from '../types';
import {
  buildSessionRecord,
  getTranscript,
  onSessionError,
  startSession,
  stopSession,
  updateJudgement,
} from './practiceSession';

describe('practiceSession (F-02, F-03, F-04, F-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('startSession (F-02)', () => {
    it('ブラウザが音声認識に対応していない場合は speech-unsupported で reject する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(false);

      await expect(startSession('free', null)).rejects.toBe('speech-unsupported');
    });

    it('マイクの使用が拒否された場合は mic-denied で reject する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      const getUserMediaMock = vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
        );
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: getUserMediaMock },
      });

      await expect(startSession('free', null)).rejects.toBe('mic-denied');
    });

    it('マイクが見つからない場合は mic-not-found で reject する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      const getUserMediaMock = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('Device not found'), { name: 'NotFoundError' }));
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: getUserMediaMock },
      });

      await expect(startSession('free', null)).rejects.toBe('mic-not-found');
    });

    it('マイクが許可された場合は音声認識を開始して resolve する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      const startSpy = vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      const stopTrackSpy = vi.fn();
      const mockStream = {
        getTracks: () => [{ stop: stopTrackSpy }],
      } as unknown as MediaStream;
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
      });

      await expect(
        startSession('custom', { title: '自分の台本', text: 'テスト台本です。' }),
      ).resolves.toBeUndefined();
      expect(startSpy).toHaveBeenCalledTimes(1);

      stopSession();
      expect(stopTrackSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTranscript & onSessionError (F-03)', () => {
    it('途中結果と確定結果をつなげて返し、練習終了時に記録へ反映する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      vi.spyOn(SpeechRecognizer.prototype, 'stop').mockImplementation(() => {});
      const onResultSpy = vi
        .spyOn(SpeechRecognizer.prototype, 'onResult')
        .mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        },
      });

      await startSession('free', null);
      expect(getTranscript()).toBe('');

      const resultCallback = onResultSpy.mock.calls[0]?.[0];
      expect(resultCallback).toBeDefined();

      resultCallback?.('こんにち', false);
      expect(getTranscript()).toBe('こんにち');

      resultCallback?.('こんにちは。', true);
      expect(getTranscript()).toBe('こんにちは。');

      resultCallback?.('今日は', false);
      expect(getTranscript()).toBe('こんにちは。今日は');

      resultCallback?.('いい天気です。', true);
      expect(getTranscript()).toBe('こんにちは。いい天気です。');

      const record = stopSession();
      expect(record.transcript).toBe('こんにちは。いい天気です。');
    });

    it('練習中に起きた音声認識エラーを onSessionError のコールバックに渡す', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      vi.spyOn(SpeechRecognizer.prototype, 'stop').mockImplementation(() => {});
      const onErrorSpy = vi
        .spyOn(SpeechRecognizer.prototype, 'onError')
        .mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        },
      });

      const handleError = vi.fn<(code: AppErrorCode) => void>();
      onSessionError(handleError);

      await startSession('free', null);
      const errorCallback = onErrorSpy.mock.calls.at(-1)?.[0];
      expect(errorCallback).toBeDefined();
      errorCallback?.('speech-network');

      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith('speech-network');

      stopSession();
    });
  });

  describe('updateJudgement (F-04)', () => {
    /** 練習を始め、文字起こし結果を流し込む関数を返す */
    async function startFreeSession(): Promise<(transcript: string, isFinal: boolean) => void> {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      vi.spyOn(SpeechRecognizer.prototype, 'stop').mockImplementation(() => {});
      const onResultSpy = vi
        .spyOn(SpeechRecognizer.prototype, 'onResult')
        .mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        },
      });

      await startSession('free', null);
      const resultCallback = onResultSpy.mock.calls[0]?.[0];
      expect(resultCallback).toBeDefined();
      return (transcript: string, isFinal: boolean): void => resultCallback?.(transcript, isFinal);
    }

    it('直近 SPEED_WINDOW_SEC 秒の文字数から cpm と speedLevel を計算する', async () => {
      const sendResult = await startFreeSession();

      // 5秒経過時点で25文字(300文字/分 → optimal)
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(25), true);
      expect(updateJudgement()).toEqual({ elapsedSec: 5, cpm: 300, speedLevel: 'optimal' });

      // 10秒経過時点で合計50文字(直近10秒で50文字 = 300文字/分 → optimal)
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(25), true);
      expect(updateJudgement()).toEqual({ elapsedSec: 10, cpm: 300, speedLevel: 'optimal' });

      // 15秒経過時点でさらに30文字(5秒〜15秒の10秒間で55文字 = 330文字/分 → optimal)
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(30), true);
      expect(updateJudgement()).toEqual({ elapsedSec: 15, cpm: 330, speedLevel: 'optimal' });

      // 20秒経過時点でさらに65文字(10秒〜20秒の10秒間で95文字 = 570文字/分 → fast)
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(65), true);
      expect(updateJudgement()).toEqual({ elapsedSec: 20, cpm: 570, speedLevel: 'fast' });

      const record = stopSession();
      // 4サンプルのうち3サンプルが optimal なので 0.75
      expect(record.speedOptimalRatio).toBe(0.75);
      expect(record.samples).toHaveLength(4);
    });

    it('SPEED_SILENCE_SEC 秒未満の間は判定を続け、それを超えて黙ると直前の判定を保つ', async () => {
      const sendResult = await startFreeSession();

      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(25), true);
      updateJudgement();
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(25), true);
      updateJudgement();

      // 12秒経過時点: 文字が増えてから2秒なので、まだ黙っているとはみなさない(12秒で50文字 = 250文字/分)
      vi.advanceTimersByTime(2000);
      expect(updateJudgement()).toEqual({
        elapsedSec: 12,
        cpm: expect.closeTo(250),
        speedLevel: 'optimal',
      });

      // 20秒経過時点: 文字が増えてから10秒。黙っているので直前の判定を保ち、記録には残さない
      vi.advanceTimersByTime(8000);
      expect(updateJudgement()).toEqual({
        elapsedSec: 20,
        cpm: expect.closeTo(250),
        speedLevel: 'optimal',
      });

      // 25秒経過時点でさらに40文字。黙っていた7秒(13秒〜20秒)を除くと話していたのは18秒。
      // 直近10秒(話していた時間で8秒〜18秒)の基準は5秒時点の25文字なので、65文字 ÷ 13秒 = 300文字/分
      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(40), true);
      expect(updateJudgement()).toEqual({ elapsedSec: 25, cpm: 300, speedLevel: 'optimal' });

      const record = stopSession();
      // 黙っていたときの計測は記録しない
      expect(record.samples?.map((sample) => sample.elapsedSec)).toEqual([5, 10, 12, 25]);
      expect(record.speedOptimalRatio).toBe(1);
      // 平均速度は黙っていた7秒を除いた18秒で90文字 = 300文字/分
      expect(record.durationSec).toBe(25);
      expect(record.averageCpm).toBe(300);
    });

    it('途中結果の書き換えで文字数が減って戻っただけでは、話したことにしない', async () => {
      const sendResult = await startFreeSession();

      vi.advanceTimersByTime(5000);
      sendResult('あ'.repeat(25), false);
      updateJudgement();

      // 途中結果が短くなる(文字が増えてから2秒なので、まだ判定は続ける)
      vi.advanceTimersByTime(2000);
      sendResult('あ'.repeat(20), false);
      const sampleAt7Sec = updateJudgement();

      // 元の文字数に戻っても、最後に文字が増えた5秒時点から3秒以上たっているので黙っているとみなす
      vi.advanceTimersByTime(2000);
      sendResult('あ'.repeat(25), true);
      expect(updateJudgement()).toEqual({ ...sampleAt7Sec, elapsedSec: 9 });

      const record = stopSession();
      expect(record.samples).toHaveLength(2);
    });

    it('話し始める前に黙っているときは 0 文字/分の判定を返し、記録には残さない', async () => {
      await startFreeSession();

      vi.advanceTimersByTime(4000);
      expect(updateJudgement()).toEqual({ elapsedSec: 4, cpm: 0, speedLevel: 'slow' });

      const record = stopSession();
      expect(record.samples).toHaveLength(0);
      expect(record.averageCpm).toBe(0);
    });
  });

  describe('buildSessionRecord & stopSession (F-07)', () => {
    it('計測サンプルと文字起こしから平均速度・最適割合・一致度を集計する', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      const stopSpy = vi.spyOn(SpeechRecognizer.prototype, 'stop').mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        },
      });

      vi.spyOn(speedCalculator, 'countCharacters').mockReturnValue(150);
      vi.spyOn(speedCalculator, 'calculateCpm').mockReturnValue(300);
      vi.spyOn(scriptMatcher, 'calculateMatchRate').mockReturnValue(85);

      await startSession('preset', { title: '外郎売', text: '拙者親方と申すは' });
      vi.advanceTimersByTime(30000);

      const samples: MeasurementSample[] = [
        { elapsedSec: 10, cpm: 240, speedLevel: 'slow' },
        { elapsedSec: 20, cpm: 300, speedLevel: 'optimal' },
        { elapsedSec: 30, cpm: 320, speedLevel: 'optimal' },
        { elapsedSec: 40, cpm: 380, speedLevel: 'fast' },
      ];

      const record = buildSessionRecord(samples, '拙者親方と申すは');
      expect(record.mode).toBe('preset');
      expect(record.scriptTitle).toBe('外郎売');
      expect(record.scriptText).toBe('拙者親方と申すは');
      expect(record.startedAt).toBe('2026-10-16T10:00:00.000Z');
      expect(record.durationSec).toBe(40);
      expect(record.charCount).toBe(150);
      expect(record.averageCpm).toBe(300);
      expect(record.speedOptimalRatio).toBe(0.5);
      expect(record.matchRate).toBe(85);

      const stoppedRecord = stopSession();
      expect(stopSpy).toHaveBeenCalled();
      expect(stoppedRecord.mode).toBe('preset');
    });

    it('台本なしモード(free)では scriptTitle, scriptText, matchRate が null になる', async () => {
      vi.spyOn(SpeechRecognizer.prototype, 'isSupported').mockReturnValue(true);
      vi.spyOn(SpeechRecognizer.prototype, 'start').mockImplementation(() => {});
      vi.spyOn(SpeechRecognizer.prototype, 'stop').mockImplementation(() => {});
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        },
      });

      await startSession('free', null);
      vi.advanceTimersByTime(15000);

      const record = stopSession();
      expect(record.mode).toBe('free');
      expect(record.scriptTitle).toBeNull();
      expect(record.scriptText).toBeNull();
      expect(record.matchRate).toBeNull();
      expect(record.durationSec).toBe(15);
      expect(record.speedOptimalRatio).toBe(0);
    });
  });
});
