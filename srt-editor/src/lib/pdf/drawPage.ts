import { rgb, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  PAGE_W, PAGE_H,
  Y_TOP, Y_NUM_BTM, Y_TIME_BTM, Y_CHAR_BTM, Y_DLG_BTM,
  X_RIGHT, X_RIGHT_P1, X_LABEL, LABEL_COL_W,
  FONT_SIZE, FONT_SIZE_PG, CHAR_SP, LINE_W,
  TIME_Y, TIME_FONT,
  CHAR_Y, DLG_Y, DLG_END,
  LINE_HW, PG_NUM_Y,
} from './constants';
import { vtext, drawHText } from './vtext';
import { smartSplit } from './layout';
import type { PageData } from './layout';

const BLACK = rgb(0, 0, 0);
const toPdfY = (pymuY: number) => PAGE_H - pymuY;

function drawFilledRect(
  page: PDFPage,
  xLeft: number, yTopPymu: number, xRight: number, yBtmPymu: number,
) {
  // yTopPymu < yBtmPymu in py-down terms (top has smaller y).
  const x = xLeft;
  const width = xRight - xLeft;
  const yPdfBottom = toPdfY(yBtmPymu);
  const height = yBtmPymu - yTopPymu;
  page.drawRectangle({ x, y: yPdfBottom, width, height, color: BLACK });
}

function drawGrid(
  page: PDFPage,
  colRights: number[],
  colLefts: number[],
  isFirst: boolean,
) {
  const vXs = new Set<number>();
  for (const v of colRights) vXs.add(v);
  for (const v of colLefts) vXs.add(v);
  if (isFirst) {
    vXs.add(X_LABEL);
    vXs.add(X_RIGHT_P1);
  }
  const xsArr = [...vXs];
  const hLeft = Math.min(...xsArr);
  const hRight = Math.max(...xsArr);

  // 水平罫線
  for (const y of [Y_TOP, Y_NUM_BTM, Y_TIME_BTM, Y_CHAR_BTM, Y_DLG_BTM]) {
    drawFilledRect(page, hLeft - LINE_HW, y - LINE_HW, hRight + LINE_HW, y + LINE_HW);
  }

  // 垂直罫線(各セクションごと)
  const sections: Array<[number, number]> = [
    [Y_TOP, Y_NUM_BTM],
    [Y_NUM_BTM, Y_TIME_BTM],
    [Y_TIME_BTM, Y_CHAR_BTM],
    [Y_CHAR_BTM, Y_DLG_BTM],
  ];
  for (const x of vXs) {
    for (const [y1, y2] of sections) {
      drawFilledRect(page, x - LINE_HW, y1 + LINE_HW, x + LINE_HW, y2 - LINE_HW);
    }
  }
}

function drawName(
  page: PDFPage, font: PDFFont,
  colRight: number, _colLeft: number, name: string,
) {
  if (!name) return;
  const maxH = Y_CHAR_BTM - 4 - CHAR_Y;
  let fs = FONT_SIZE;
  let sp = CHAR_SP;
  while (name.length * sp > maxH && fs > 7.0) {
    fs -= 0.5;
    sp = fs;
  }
  const xCenter = colRight - LINE_W / 2;
  vtext({ page, font, fontsize: fs, charSp: sp }, xCenter, CHAR_Y, name);
}

function drawDialogue(
  page: PDFPage, font: PDFFont,
  colRight: number, colLeft: number, text: string,
) {
  if (!text) return;
  let fs = FONT_SIZE;
  let sp = CHAR_SP;
  const lw = LINE_W;
  const availLines = Math.max(1, Math.floor((colRight - colLeft) / lw));

  while (fs > 8.0) {
    const cpc = Math.floor((DLG_END - DLG_Y) / sp);
    const vlines = smartSplit(text, cpc);
    if (vlines.length <= availLines) break;
    fs -= 0.5;
    sp = fs;
  }

  const cpc = Math.floor((DLG_END - DLG_Y) / sp);
  const vlines = smartSplit(text, cpc);
  let xCenter = colRight - lw / 2;
  for (const vl of vlines) {
    if (xCenter - lw / 2 < colLeft - 1) break;
    vtext({ page, font, fontsize: fs, charSp: sp }, xCenter, DLG_Y, vl);
    xCenter -= lw;
  }
}

export function drawPage(
  doc: PDFDocument,
  font: PDFFont,
  pageData: PageData,
  pageNum: number,
  isFirst: boolean,
) {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const dataRight = isFirst ? X_LABEL : X_RIGHT;

  const colRights: number[] = [];
  let x = dataRight;
  for (const w of pageData.widths) {
    colRights.push(x);
    x -= w;
  }
  const colLefts = pageData.widths.map((w, i) => colRights[i] - w);

  drawGrid(page, colRights, colLefts, isFirst);

  // ラベル(1ページ目のみ)
  if (isFirst) {
    const lx = X_LABEL + LABEL_COL_W / 2;
    vtext({ page, font }, lx, 131.3, 'タイム');
    vtext({ page, font }, lx, 266.2, '人物');
    vtext({ page, font }, lx, 379.7, 'セリフ');
  }

  for (let i = 0; i < pageData.widths.length; i += 1) {
    const cr = colRights[i];
    const cl = colLefts[i];
    const cw = pageData.widths[i];
    const cx = (cr + cl) / 2;
    const seq = pageData.seqs[i];
    const startTc = pageData.starts[i];
    const endTc = pageData.ends[i];
    const charDlgs = pageData.charDialogs[i];

    // カット番号(横書き・中央)
    const ns = String(seq);
    const tw = font.widthOfTextAtSize(ns, FONT_SIZE);
    drawHText(page, font, ns, cx - tw / 2, Y_TOP + (Y_NUM_BTM - Y_TOP) * 0.7, FONT_SIZE);

    // タイムコード(rotate=270 = -90°)
    let timeFs = Math.min(TIME_FONT, (cw - 4) / 2);
    timeFs = Math.max(5.0, timeFs);

    // 開始時刻(列の右寄り)
    const startX = cx + timeFs * 0.7;
    drawHText(page, font, startTc, startX, TIME_Y, timeFs, -90);

    // "-->" 矢印(開始時刻の下)
    const startLen = font.widthOfTextAtSize(startTc, timeFs);
    const arrowY = TIME_Y + startLen + 3;
    if (arrowY + font.widthOfTextAtSize('-->', timeFs) < Y_TIME_BTM - 2) {
      drawHText(page, font, '-->', startX, arrowY, timeFs, -90);
    }

    // 終了時刻(列の左寄り)
    const endX = cx - timeFs * 0.7;
    drawHText(page, font, endTc, endX, TIME_Y, timeFs, -90);

    // 人物名・セリフ
    const n = charDlgs.length;
    if (n === 0) continue;
    if (n === 1) {
      const { name, dialogue } = charDlgs[0];
      if (name) drawName(page, font, cr, cl, name);
      if (dialogue) drawDialogue(page, font, cr, cl, dialogue);
    } else {
      const subW = cw / n;
      for (let j = 0; j < n; j += 1) {
        const subRight = cr - j * subW;
        const subLeft = subRight - subW;
        const { name, dialogue } = charDlgs[j];
        if (name) drawName(page, font, subRight, subLeft, name);
        if (dialogue) drawDialogue(page, font, subRight, subLeft, dialogue);
      }
    }
  }

  // ページ番号
  const pn = String(pageNum);
  const pw = font.widthOfTextAtSize(pn, FONT_SIZE_PG);
  drawHText(page, font, pn, PAGE_W / 2 - pw / 2, PG_NUM_Y + FONT_SIZE_PG, FONT_SIZE_PG);
}
