import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parseSpeakerTags } from '../srt';
import { formatTimecode } from '../time';
import { packPages } from './layout';
import { drawPage } from './drawPage';
import type { SrtEntry } from '../../types';

let fontBytesCache: ArrayBuffer | null = null;

async function loadFontBytes(): Promise<ArrayBuffer> {
  if (fontBytesCache) return fontBytesCache;
  const res = await fetch('/fonts/NotoSerifJP-Regular.ttf');
  if (!res.ok) throw new Error(`フォント取得失敗: ${res.status}`);
  fontBytesCache = await res.arrayBuffer();
  return fontBytesCache;
}

export async function generatePdf(entries: SrtEntry[]): Promise<Uint8Array> {
  if (entries.length === 0) throw new Error('SRTエントリが空です');

  const sorted = [...entries].sort((a, b) => a.startMs - b.startMs);
  const layoutEntries = sorted.map((e, i) => ({
    seq: i + 1,
    start: formatTimecode(e.startMs),
    end: formatTimecode(e.endMs),
    charDialogs: parseSpeakerTags(e.text),
  }));

  const pages = packPages(layoutEntries);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await loadFontBytes();
  const font = await doc.embedFont(fontBytes, { subset: true });

  pages.forEach((pd, i) => {
    drawPage(doc, font, pd, i + 1, i === 0);
  });

  return await doc.save();
}
