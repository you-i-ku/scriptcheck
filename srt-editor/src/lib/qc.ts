import type { SrtEntry } from '../types';

const TAG_RE = /^[(（][^)）]+[)）]\s*/gm;

export function stripSpeakerTags(text: string): string {
  return text.replace(TAG_RE, '');
}

export function effectiveChars(text: string): number {
  let total = 0;
  for (const c of text) {
    if (c === '\n' || c === ' ' || c === '　' || c === '\t') continue;
    total += 1;
  }
  return total;
}

export function computeCps(entry: SrtEntry, excludeSpeakerTag: boolean): number {
  const text = excludeSpeakerTag ? stripSpeakerTags(entry.text) : entry.text;
  const chars = effectiveChars(text);
  const sec = (entry.endMs - entry.startMs) / 1000;
  if (sec <= 0) return 0;
  return chars / sec;
}

export type QcIssueType = 'cps' | 'duplicate' | 'gap' | 'minDuration' | 'kinsoku';

export type QcIssue = {
  entryId: string;
  severity: 'error' | 'warn';
  type: QcIssueType;
  message: string;
};

export type QcOptions = {
  cpsThreshold: number;
  minGapMs: number;
  minDurationMs: number;
  excludeSpeakerTagFromCps: boolean;
  checkKinsoku: boolean;
};

export const DEFAULT_QC_OPTIONS: QcOptions = {
  cpsThreshold: 17,
  minGapMs: 84,       // ~2 frames at 24fps, Netflix基準
  minDurationMs: 700, // 一般的な下限
  excludeSpeakerTagFromCps: true,
  checkKinsoku: true,
};

// 行頭禁則の代表パターン(助詞・句読点・閉じ括弧)
const KINSOKU_LINE_START = new Set([
  'を', 'は', 'が', 'の', 'に', 'で', 'と', 'か', 'へ', 'も',
  '、', '。', '，', '．',
  '）', '」', '』', '】', ')', ']', '}',
]);

export function findIssues(entries: SrtEntry[], opts: QcOptions): QcIssue[] {
  const issues: QcIssue[] = [];
  const sorted = [...entries].sort((a, b) => a.startMs - b.startMs);

  // CPS
  for (const e of entries) {
    const cps = computeCps(e, opts.excludeSpeakerTagFromCps);
    if (cps > opts.cpsThreshold) {
      issues.push({
        entryId: e.id,
        severity: 'error',
        type: 'cps',
        message: `読み速度 ${cps.toFixed(1)} CPS (閾値 ${opts.cpsThreshold})`,
      });
    }
  }

  // 最短表示時間
  for (const e of entries) {
    const dur = e.endMs - e.startMs;
    if (dur < opts.minDurationMs) {
      issues.push({
        entryId: e.id,
        severity: 'warn',
        type: 'minDuration',
        message: `表示時間 ${(dur / 1000).toFixed(2)}秒 (推奨 ${opts.minDurationMs / 1000}秒以上)`,
      });
    }
  }

  // 重複 / ギャップ不足
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b.startMs - a.endMs;
    if (gap < 0) {
      issues.push({
        entryId: a.id,
        severity: 'error',
        type: 'duplicate',
        message: `次と${(-gap / 1000).toFixed(2)}秒重複`,
      });
    } else if (gap < opts.minGapMs) {
      issues.push({
        entryId: a.id,
        severity: 'warn',
        type: 'gap',
        message: `次との間隔 ${gap}ms (推奨 ${opts.minGapMs}ms以上)`,
      });
    }
  }

  // 禁則処理(改行後の行頭)
  if (opts.checkKinsoku) {
    for (const e of entries) {
      const lines = e.text.split('\n');
      for (let i = 1; i < lines.length; i += 1) {
        const firstChar = lines[i][0];
        if (firstChar && KINSOKU_LINE_START.has(firstChar)) {
          issues.push({
            entryId: e.id,
            severity: 'warn',
            type: 'kinsoku',
            message: `行頭禁則: "${firstChar}" が改行の頭に`,
          });
          break;
        }
      }
    }
  }

  return issues;
}

export type IssuesByEntry = Record<string, QcIssue[]>;

export function groupIssuesByEntry(issues: QcIssue[]): IssuesByEntry {
  const out: IssuesByEntry = {};
  for (const issue of issues) {
    (out[issue.entryId] = out[issue.entryId] ?? []).push(issue);
  }
  return out;
}

export function cpsColor(cps: number, threshold: number): string {
  if (cps === 0) return '#555';
  const ratio = cps / threshold;
  if (ratio > 1.0) return '#ff4d4d';      // 違反(赤)
  if (ratio > 0.8) return '#ffa940';      // 警告(オレンジ)
  if (ratio > 0.6) return '#ffd93d';      // 注意(黄)
  return '#5cd65c';                        // OK(緑)
}
