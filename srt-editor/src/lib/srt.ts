import { parseTimecode, formatTimecode } from './time';
import type { SrtEntry, CharDialogue } from '../types';

export function parseSrt(input: string): SrtEntry[] {
  const content = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = content.split(/\n\n+/);
  const entries: SrtEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const seq = parseInt(lines[0].trim(), 10);
    if (!Number.isFinite(seq)) continue;

    const m = lines[1].match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/
    );
    if (!m) continue;

    const startMs = parseTimecode(m[1]);
    const endMs = parseTimecode(m[2]);
    const text = lines.slice(2).join('\n');

    entries.push({
      id: crypto.randomUUID(),
      seq,
      startMs,
      endMs,
      text,
    });
  }

  return entries;
}

export function serializeSrt(entries: SrtEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.startMs - b.startMs);
  const blocks = sorted.map((e, i) =>
    `${i + 1}\n${formatTimecode(e.startMs)} --> ${formatTimecode(e.endMs)}\n${e.text}`
  );
  return blocks.join('\n\n') + '\n';
}

export type SpeakerPair = { name: string; text: string };

/**
 * テキスト編集用: 話者タグのクリーンアップ(HTMLタグ除去等)はせず、
 * 元の文字を保持したままペアに分解する。
 */
export function parseSpeakerPairs(text: string): SpeakerPair[] {
  if (text === '') return [{ name: '', text: '' }];
  const pairs: SpeakerPair[] = [];
  for (const rawLine of text.split('\n')) {
    let m = rawLine.match(/^（(.+?)）\s*([\s\S]*)$/);
    if (!m) m = rawLine.match(/^\(([^)]+)\)\s*([\s\S]*)$/);
    if (m) {
      pairs.push({ name: m[1], text: m[2] });
    } else if (pairs.length > 0) {
      // 話者タグで始まらない行 → 直前の話者のセリフに継続(同一話者の複数行)
      const last = pairs[pairs.length - 1];
      last.text = last.text ? `${last.text}\n${rawLine}` : rawLine;
    } else {
      pairs.push({ name: '', text: rawLine });
    }
  }
  return pairs.length > 0 ? pairs : [{ name: '', text: '' }];
}

export function serializeSpeakerPairs(pairs: SpeakerPair[]): string {
  return pairs
    .map((p) => (p.name.trim() ? `（${p.name.trim()}）${p.text}` : p.text))
    .join('\n');
}

export function parseSpeakerTags(text: string): CharDialogue[] {
  const result: CharDialogue[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (result.length) {
        const last = result[result.length - 1];
        last.dialogue = last.dialogue ? `${last.dialogue}\n` : '\n';
      }
      continue;
    }
    let m = line.match(/^（(.+?)）\s*(.*)$/);
    if (!m) m = line.match(/^\(([^)]+)\)\s*(.*)$/);
    if (m) {
      result.push({ name: m[1], dialogue: m[2].trim() });
    } else if (result.length) {
      const last = result[result.length - 1];
      last.dialogue = last.dialogue ? `${last.dialogue}\n${line}` : line;
    } else {
      result.push({ name: '', dialogue: line });
    }
  }
  return result.map(({ name, dialogue }) => ({
    name,
    dialogue: dialogue
      .replace(/<[^>]+>/g, '')
      .replace(/⸺/g, '——')
      .replace(/⸻/g, '———')
      .replace(/—/g, '—')
      .trim(),
  }));
}
