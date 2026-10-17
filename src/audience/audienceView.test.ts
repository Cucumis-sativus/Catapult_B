import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudienceSpriteKey } from '../types';
import { AudienceView } from './audienceView';

/** テスト用の擬似 img 要素 */
interface MockImageElement {
  className: string;
  src: string;
  alt: string;
  dataset: Record<string, string>;
  decode?: () => Promise<void>;
}

/** テスト用の擬似コンテナ要素 */
interface MockContainer {
  children: MockImageElement[];
  append: (...nodes: MockImageElement[]) => void;
}

/** 擬似 img 要素を生成する */
function createMockImageElement(): MockImageElement {
  return {
    className: '',
    src: '',
    alt: '',
    dataset: {},
  };
}

/** 擬似コンテナ要素を生成する */
function createMockContainer(): MockContainer {
  const children: MockImageElement[] = [];
  return {
    children,
    append: (...nodes: MockImageElement[]): void => {
      children.push(...nodes);
    },
  };
}

describe('AudienceView (F-05)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tagName: string): MockImageElement => {
        expect(tagName).toBe('img');
        return createMockImageElement();
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('初期化時にコンテナへ背景と通常の観客の img 要素を追加する', () => {
    const container = createMockContainer();

    new AudienceView(container as unknown as HTMLElement);

    expect(container.children).toHaveLength(2);
    const [background, img] = container.children;
    expect(background?.className).toBe('audience-background');
    expect(background?.src).toBe('/sprites/sprite_bg.svg');
    expect(background?.alt).toBe('');
    expect(img?.className).toBe('audience-sprite');
    expect(img?.src).toBe('/sprites/sprite_normal.svg');
    expect(img?.alt).toBe('観客');
  });

  it('loadSprites で3種類の観客スプライト画像を先に読み込む', async () => {
    const createdImages: MockImageElement[] = [];
    const decodeMock = vi.fn().mockResolvedValue(undefined);

    class FakeImage implements MockImageElement {
      className = '';
      src = '';
      alt = '';
      dataset: Record<string, string> = {};
      decode = decodeMock;
      constructor() {
        createdImages.push(this);
      }
    }

    vi.stubGlobal('Image', FakeImage);
    const container = createMockContainer();
    const view = new AudienceView(container as unknown as HTMLElement);

    await view.loadSprites();

    expect(createdImages).toHaveLength(3);
    expect(createdImages.map((img) => img.src)).toEqual([
      '/sprites/audience_slow.png',
      '/sprites/audience_optimal.png',
      '/sprites/audience_fast.png',
    ]);
    expect(decodeMock).toHaveBeenCalledTimes(3);
  });

  it('loadSprites で画像の decode が失敗しても例外を投げずに完了する', async () => {
    class FailingDecodeImage implements MockImageElement {
      className = '';
      src = '';
      alt = '';
      dataset: Record<string, string> = {};
      decode = vi.fn().mockRejectedValue(new Error('decode error'));
    }

    vi.stubGlobal('Image', FailingDecodeImage);
    const container = createMockContainer();
    const view = new AudienceView(container as unknown as HTMLElement);

    await expect(view.loadSprites()).resolves.toBeUndefined();
  });

  it('setSprite で4.3の対応表どおりに画像を切り替える', () => {
    const container = createMockContainer();
    const view = new AudienceView(container as unknown as HTMLElement);
    const img = container.children[1]!;

    const cases: {
      spriteKey: AudienceSpriteKey;
      expectedSrc: string;
      expectedAlt: string;
      expectedLevel: string;
    }[] = [
      {
        spriteKey: 'audience_slow',
        expectedSrc: '/sprites/audience_slow.png',
        expectedAlt: '観客(遅い)',
        expectedLevel: 'slow',
      },
      {
        spriteKey: 'audience_optimal',
        expectedSrc: '/sprites/audience_optimal.png',
        expectedAlt: '観客(最適)',
        expectedLevel: 'optimal',
      },
      {
        spriteKey: 'audience_fast',
        expectedSrc: '/sprites/audience_fast.png',
        expectedAlt: '観客(速い)',
        expectedLevel: 'fast',
      },
    ];

    for (const testCase of cases) {
      view.setSprite(testCase.spriteKey);
      expect(img.src).toBe(testCase.expectedSrc);
      expect(img.alt).toBe(testCase.expectedAlt);
      expect(img.dataset.spriteKey).toBe(testCase.spriteKey);
      expect(img.dataset.speedLevel).toBe(testCase.expectedLevel);
    }
  });

  it('setSprite に前回と同じスプライトキーを渡した場合は画像の切り替えを行わない', () => {
    const container = createMockContainer();
    const view = new AudienceView(container as unknown as HTMLElement);
    const img = container.children[1]!;

    let srcValue = img.src;
    const srcSetterSpy = vi.fn((nextSrc: string) => {
      srcValue = nextSrc;
    });
    Object.defineProperty(img, 'src', {
      get: () => srcValue,
      set: srcSetterSpy,
      configurable: true,
    });

    // 1回目: audience_slow に切り替わる
    view.setSprite('audience_slow');
    expect(srcSetterSpy).toHaveBeenCalledTimes(1);
    expect(img.src).toBe('/sprites/audience_slow.png');

    // 2回目: 同じ audience_slow なので何もしない
    view.setSprite('audience_slow');
    expect(srcSetterSpy).toHaveBeenCalledTimes(1);

    // 3回目: audience_fast に変わるため更新される
    view.setSprite('audience_fast');
    expect(srcSetterSpy).toHaveBeenCalledTimes(2);
    expect(img.src).toBe('/sprites/audience_fast.png');
  });
});
