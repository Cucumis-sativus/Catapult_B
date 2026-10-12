import type { AudienceSpriteKey } from '../types';

// 観客スプライトの表示(F-05、要件定義書 4.3)
// 画像は public/sprites/{spriteKey}.png。パスは SPRITE_BASE_PATH から作る
// 描画方法(PixiJS か <img> の切り替えか)は【未決定】
export class AudienceView {
  /** container: 観客を描く場所(練習画面が渡す) */
  constructor(container: HTMLElement) {
    // TODO(F-05): 未実装
  }

  /** 3枚の画像を先に読み込む */
  async loadSprites(): Promise<void> {
    // TODO(F-05): 未実装
  }

  /** 観客の画像を切り替える。前回と同じキーなら何もしない */
  setSprite(spriteKey: AudienceSpriteKey): void {
    // TODO(F-05): 未実装
  }
}
