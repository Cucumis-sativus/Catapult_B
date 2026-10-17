// 速さの計算(F-04、要件定義書 4.1)

/** 数えない文字(句読点・記号・空白・改行・見えない制御文字)。長音符「ー」や「々」は文字として数える */
const NON_COUNTED_CHAR_PATTERN = /[\p{P}\p{S}\p{Z}\p{Cf}\s]/gu;

/** 句読点・空白・記号を除いた文字数を返す */
export function countCharacters(text: string): number {
  // 半角カナや分かれた濁点を1文字にまとめる(「ｶﾞ」→「ガ」)
  const normalizedText = text.normalize('NFKC');
  // 「𠮷」のようにサロゲートペアで表す文字も1文字と数えるため、配列にしてから数える
  return Array.from(normalizedText.replace(NON_COUNTED_CHAR_PATTERN, '')).length;
}

/** 文字/分を計算する(4.1の式) */
export function calculateCpm(charCount: number, elapsedSec: number): number {
  // 練習開始直後など経過時間が0のときは割れないので0とする。
  // NaN などが来ると judgeSpeed で 'optimal' と判定されてしまうため、数値でないときも0とする
  if (!Number.isFinite(charCount) || !Number.isFinite(elapsedSec) || elapsedSec <= 0) {
    return 0;
  }
  return (charCount / elapsedSec) * 60;
}
