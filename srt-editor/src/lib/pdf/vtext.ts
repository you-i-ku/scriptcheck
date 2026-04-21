import { degrees, type PDFFont, type PDFPage } from 'pdf-lib';
import { PAGE_H, ROTATE_CHARS, SMALL_KANA, PUNCTUATION_TR, FONT_SIZE, CHAR_SP } from './constants';

// PyMuPDF y-from-top → pdf-lib y-from-bottom
const toPdfY = (pymuY: number) => PAGE_H - pymuY;

type TextOpts = {
  page: PDFPage;
  font: PDFFont;
  fontsize?: number;
  charSp?: number;
};

export function vtext(
  { page, font, fontsize = FONT_SIZE, charSp = CHAR_SP }: TextOpts,
  xCenter: number,
  yTop: number,
  text: string,
): number {
  let cy = yTop;
  for (const ch of text) {
    if (ch === ' ' || ch === '　') {
      cy += charSp * 0.5;
      continue;
    }
    const cw = font.widthOfTextAtSize(ch, fontsize);

    if (ROTATE_CHARS.has(ch)) {
      // Python: morph=(pivot, Matrix(-90)) around pivot = (xCenter, cy - fontsize*0.3)
      // drawX(python) = xCenter - cw/2, drawY(python) = cy
      // CW 90° rotation of (dx, dy) in y-down: (-dy, dx)
      // dx = drawX - pivotX = -cw/2
      // dy = cy - pivotY = fontsize * 0.3
      // rotated offset (in pymu y-down): (-fontsize*0.3, -cw/2)
      // new anchor in pymu: (pivotX - fontsize*0.3, pivotY - cw/2)
      //                   = (xCenter - fontsize*0.3, cy - fontsize*0.3 - cw/2)
      const pivotX = xCenter;
      const pivotYPymu = cy - fontsize * 0.3;
      const newXPymu = pivotX - fontsize * 0.3;
      const newYPymu = pivotYPymu - cw / 2;
      page.drawText(ch, {
        x: newXPymu,
        y: toPdfY(newYPymu),
        font,
        size: fontsize,
        rotate: degrees(-90),
      });
    } else if (SMALL_KANA.has(ch)) {
      const drawX = xCenter - cw / 2 + fontsize * 0.12;
      const drawYPymu = cy - fontsize * 0.08;
      page.drawText(ch, {
        x: drawX,
        y: toPdfY(drawYPymu),
        font,
        size: fontsize,
      });
    } else if (PUNCTUATION_TR.has(ch)) {
      const drawX = xCenter + fontsize * 0.1;
      const drawYPymu = cy - fontsize * 0.5;
      page.drawText(ch, {
        x: drawX,
        y: toPdfY(drawYPymu),
        font,
        size: fontsize,
      });
    } else {
      const drawX = xCenter - cw / 2;
      page.drawText(ch, {
        x: drawX,
        y: toPdfY(cy),
        font,
        size: fontsize,
      });
    }
    cy += charSp;
  }
  return cy;
}

export function drawHText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  xPymu: number,
  yPymu: number,
  fontsize: number,
  rotate?: number,
) {
  page.drawText(text, {
    x: xPymu,
    y: toPdfY(yPymu),
    font,
    size: fontsize,
    rotate: rotate !== undefined ? degrees(rotate) : undefined,
  });
}
