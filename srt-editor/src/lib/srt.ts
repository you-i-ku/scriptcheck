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

export function parseSpeakerTags(text: string): CharDialogue[] {
  const result: CharDialogue[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    let m = line.match(/^（(.+?)）\s*(.*)$/);
    if (!m) m = line.match(/^\(([^)]+)\)\s*(.*)$/);
    if (m) {
      result.push({ name: m[1], dialogue: m[2].trim() });
    } else if (result.length) {
      const last = result[result.length - 1];
      last.dialogue = (last.dialogue + ' ' + line).trim();
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
