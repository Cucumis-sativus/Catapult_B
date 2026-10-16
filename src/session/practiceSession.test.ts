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
} from './practiceSession';

describe('practiceSession (F-02, F-03, F-07)', () => {
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
