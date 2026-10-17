import { SPEED_LEVEL_LABELS, SPRITE_BASE_PATH } from '../constants';
import type { AudienceSpriteKey, SpeedLevel } from '../types';

// 観客スプライトの表示(F-05、要件定義書 4.3)
// 画像は public/sprites/{spriteKey}.png。パスは SPRITE_BASE_PATH から作る
// 背景(sprite_bg)の上に観客の画像を重ねる。2枚は同じ縦横比で、そのまま重ねると位置が合う
// 判定が出る前は通常の観客(sprite_normal)を出す
// TODO【未決定】: 描画方法(PixiJS か <img> の切り替えか)は未決定のため、仮実装として <img> の切り替えで表示する
// TODO【未決定】: 観客の人数、画像サイズ、アニメーションの有無は未決定
// TODO: audience_slow / optimal / fast の画像は仮置き(sprite_normal に色を付けたもの)。絵ができたら差し替える

/** 背景の画像ファイル名。どの状態でも変わらない */
const BACKGROUND_SPRITE_FILE = 'sprite_bg.svg';

/** 判定が出る前(起動時、練習開始直後)の観客の画像ファイル名 */
const NORMAL_SPRITE_FILE = 'sprite_normal.svg';

/** 読み込む3種類のスプライトキー一覧(4.3の表) */
const AUDIENCE_SPRITE_KEYS: readonly AudienceSpriteKey[] = [
  'audience_slow',
  'audience_optimal',
  'audience_fast',
];

/** スプライトキーに対応する代替テキストのマップ */
const SPRITE_ALT_LABELS: Record<AudienceSpriteKey, string> = {
  audience_slow: `観客(${SPEED_LEVEL_LABELS.slow})`,
  audience_optimal: `観客(${SPEED_LEVEL_LABELS.optimal})`,
  audience_fast: `観客(${SPEED_LEVEL_LABELS.fast})`,
};

/** スプライトキーから画像ファイルのパスを作る */
function buildSpritePath(spriteKey: AudienceSpriteKey): string {
  return `${SPRITE_BASE_PATH}${spriteKey}.png`;
}

/** スプライトキーから SpeedLevel を取り出す */
function extractSpeedLevel(spriteKey: AudienceSpriteKey): SpeedLevel {
  switch (spriteKey) {
    case 'audience_slow':
      return 'slow';
    case 'audience_optimal':
      return 'optimal';
    case 'audience_fast':
      return 'fast';
  }
}

export class AudienceView {
  /** 観客画像を表示する img 要素 */
  private readonly imageElement: HTMLImageElement;

  /** 現在表示しているスプライトキー(未設定時は null) */
  private currentSpriteKey: AudienceSpriteKey | null = null;

  /** 先読みした画像要素のキャッシュ */
  private readonly preloadedImages = new Map<AudienceSpriteKey, HTMLImageElement>();

  /** container: 観客を描く場所(ホーム画面と練習画面が渡す) */
  constructor(container: HTMLElement) {
    // 背景は飾りなので代替テキストを空にする
    const backgroundImage = document.createElement('img');
    backgroundImage.className = 'audience-background';
    backgroundImage.src = `${SPRITE_BASE_PATH}${BACKGROUND_SPRITE_FILE}`;
    backgroundImage.alt = '';

    // まだ判定が出ていないあいだは通常の観客を出す
    const img = document.createElement('img');
    img.className = 'audience-sprite';
    img.src = `${SPRITE_BASE_PATH}${NORMAL_SPRITE_FILE}`;
    img.alt = '観客';
    this.imageElement = img;
    container.append(backgroundImage, img);
  }

  /** 3枚の画像を先に読み込む */
  async loadSprites(): Promise<void> {
    this.preloadedImages.clear();

    const loadPromises = AUDIENCE_SPRITE_KEYS.map(async (spriteKey): Promise<void> => {
      const spritePath = buildSpritePath(spriteKey);
      const img = typeof Image !== 'undefined' ? new Image() : document.createElement('img');
      img.src = spritePath;
      img.alt = SPRITE_ALT_LABELS[spriteKey];
      this.preloadedImages.set(spriteKey, img);

      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          // 画像のデコードに失敗しても練習進行は止めない
        }
      }
    });

    await Promise.all(loadPromises);
  }

  /** 観客の画像を切り替える。前回と同じキーなら何もしない */
  setSprite(spriteKey: AudienceSpriteKey): void {
    if (this.currentSpriteKey === spriteKey) {
      return;
    }

    this.currentSpriteKey = spriteKey;
    const preloaded = this.preloadedImages.get(spriteKey);
    this.imageElement.src = preloaded ? preloaded.src : buildSpritePath(spriteKey);
    this.imageElement.alt = SPRITE_ALT_LABELS[spriteKey];
    if (this.imageElement.dataset) {
      this.imageElement.dataset.spriteKey = spriteKey;
      this.imageElement.dataset.speedLevel = extractSpeedLevel(spriteKey);
    }
  }
}
