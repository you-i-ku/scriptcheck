// Python script の座標定数を 1:1 移植。
// PyMuPDF は y が上から、pdf-lib は y が下から。変換は描画時に行う。

export const PAGE_W = 515.9;
export const PAGE_H = 728.5;

// セクション Y 座標(水平罫線の中心, from top)
export const Y_TOP = 71.1;
export const Y_NUM_BTM = 113.6;
export const Y_TIME_BTM = 248.6;
export const Y_CHAR_BTM = 362.0;
export const Y_DLG_BTM = 638.3;

// X 座標
export const X_LEFT = 79.0;
export const X_RIGHT = 472.4;
export const X_RIGHT_P1 = 478.2;
export const LABEL_COL_W = 24.0;
export const X_LABEL = X_RIGHT_P1 - LABEL_COL_W;

// フォント
export const FONT_SIZE = 13.0;
export const FONT_SIZE_PG = 10.6;
export const CHAR_SP = 13.0;
export const LINE_W = 15.0;

// タイムコード
export const TIME_Y = 119.6;
export const TIME_FONT = 9.0;

// 人物名・セリフ
export const CHAR_Y = 265.9;
export const DLG_Y = 379.4;
export const DLG_END = Y_DLG_BTM - 8;
export const CHARS_PER_COL = Math.floor((DLG_END - DLG_Y) / CHAR_SP);
export const CHARS_PER_NAME = Math.floor((Y_CHAR_BTM - 4 - CHAR_Y) / CHAR_SP);

// 罫線
export const LINE_HW = 0.24;

// 最小列幅
export const MIN_COL_W = 38.0;

// ページ番号
export const PG_NUM_Y = 656.3;

// 縦書きで 90° 回転する文字(括弧類含む)
export const ROTATE_CHARS = new Set('ー〜～…—─＝ｰ（）()「」『』【】');

// 小かな(縦書きで右寄せ)
export const SMALL_KANA = new Set('っゃゅょぁぃぅぇぉッャュョァィゥェォ');

// 句読点(縦書きで右上寄せ)
export const PUNCTUATION_TR = new Set('、。，．');
