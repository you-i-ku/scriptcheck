import { loadDefaultJapaneseParser } from 'budoux';
import {
  LINE_W, MIN_COL_W, X_LEFT, X_LABEL, X_RIGHT,
  CHARS_PER_COL, CHARS_PER_NAME,
} from './constants';
import type { CharDialogue } from '../../types';

const parser = loadDefaultJapaneseParser();

export function effectiveLen(text: string): number {
  let total = 0;
  for (const c of text) total += c === ' ' || c === '　' ? 0.5 : 1;
  return total;
}

export function smartSplit(text: string, maxChars: number): string[] {
  if (!text) return [];
  if (/\r?\n/.test(text)) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').flatMap((line) => {
      if (!line) return [''];
      return smartSplit(line, maxChars);
    });
  }
  if (effectiveLen(text) <= maxChars) return [text];

  const chunks = parser.parse(text);
  const lines: string[] = [];
  let current = '';
  let currentLen = 0;

  for (const chunk of chunks) {
    const chunkLen = effectiveLen(chunk);
    if (chunkLen > maxChars) {
      for (const ch of chunk) {
        const chLen = ch === ' ' || ch === '　' ? 0.5 : 1;
        if (currentLen + chLen > maxChars && current) {
          lines.push(current);
          current = '';
          currentLen = 0;
        }
        current += ch;
        currentLen += chLen;
      }
    } else if (currentLen + chunkLen > maxChars && current) {
      lines.push(current);
      current = chunk;
      currentLen = chunkLen;
    } else {
      current += chunk;
      currentLen += chunkLen;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function calcColWidth(charDlgs: CharDialogue[]): number {
  if (charDlgs.length === 0) return MIN_COL_W;
  let totalLines = 0;
  for (const { name, dialogue } of charDlgs) {
    const nameLines = name ? smartSplit(name, CHARS_PER_NAME).length : 0;
    const dlgLines = dialogue ? smartSplit(dialogue, CHARS_PER_COL).length : 0;
    totalLines += Math.max(nameLines, dlgLines, 1);
  }
  const needed = totalLines * LINE_W;
  return Math.max(MIN_COL_W, needed);
}

export type PageData = {
  charDialogs: CharDialogue[][];  // per entry
  seqs: number[];
  starts: string[];
  ends: string[];
  widths: number[];
};

export function packPages(
  entries: Array<{
    seq: number;
    start: string;
    end: string;
    charDialogs: CharDialogue[];
  }>,
): PageData[] {
  const pages: PageData[] = [];
  let idx = 0;
  let pg = 0;
  while (idx < entries.length) {
    pg += 1;
    const isFirst = pg === 1;
    const avail = (isFirst ? X_LABEL : X_RIGHT) - X_LEFT;

    const pgEntries: typeof entries = [];
    const pgWidths: number[] = [];
    let total = 0;

    while (idx < entries.length) {
      const w = calcColWidth(entries[idx].charDialogs);
      if (total + w > avail && pgEntries.length > 0) break;
      pgEntries.push(entries[idx]);
      pgWidths.push(w);
      total += w;
      idx += 1;
    }

    if (pgEntries.length > 0 && total < avail) {
      const extra = (avail - total) / pgEntries.length;
      for (let i = 0; i < pgWidths.length; i += 1) pgWidths[i] += extra;
    }

    pages.push({
      charDialogs: pgEntries.map((e) => e.charDialogs),
      seqs: pgEntries.map((e) => e.seq),
      starts: pgEntries.map((e) => e.start),
      ends: pgEntries.map((e) => e.end),
      widths: pgWidths,
    });
  }
  return pages;
}
