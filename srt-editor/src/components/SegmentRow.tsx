import { memo, useCallback, useMemo, useRef } from 'react';
import type { SrtEntry } from '../types';
import { formatTimecode, parseTimecode } from '../lib/time';
import { computeCps, cpsColor, type QcIssue } from '../lib/qc';

type Props = {
  entry: SrtEntry;
  index: number;
  active: boolean;
  selected: boolean;
  issues: QcIssue[];
  cpsThreshold: number;
  excludeSpeakerTagFromCps: boolean;
  onPatch: (patch: Partial<SrtEntry>, coalesceKey?: string) => void;
  onJump: () => void;
  onFocus: () => void;
  onDelete: () => void;
  onMergeNext: () => void;
  onSplitAtCursor: (charIndex: number) => void;
  onSetInFromCurrent: () => void;
  onSetOutFromCurrent: () => void;
};

// 先頭が `（話者）` または `(話者)` の単一話者パターン
const SINGLE_SPEAKER_RE = /^[(（]([^)）]+)[)）]\s*([\s\S]*)$/;

function splitSpeakerAndBody(text: string): {
  speaker: string;
  body: string;
  isMulti: boolean;
} {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const tagLines = lines.filter((l) => /^[(（][^)）]+[)）]/.test(l));
  if (tagLines.length > 1) {
    return { speaker: '', body: text, isMulti: true };
  }
  const m = text.match(SINGLE_SPEAKER_RE);
  if (m) return { speaker: m[1], body: m[2], isMulti: false };
  return { speaker: '', body: text, isMulti: false };
}

function joinSpeakerAndBody(speaker: string, body: string): string {
  const trimmedSpeaker = speaker.trim();
  if (!trimmedSpeaker) return body;
  return `（${trimmedSpeaker}）${body}`;
}

export const SegmentRow = memo(function SegmentRow({
  entry, index, active, selected, issues,
  cpsThreshold, excludeSpeakerTagFromCps,
  onPatch, onJump, onFocus, onDelete, onMergeNext, onSplitAtCursor,
  onSetInFromCurrent, onSetOutFromCurrent,
}: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { speaker, body, isMulti } = useMemo(
    () => splitSpeakerAndBody(entry.text),
    [entry.text],
  );

  const handleTcChange = useCallback(
    (field: 'startMs' | 'endMs', value: string) => {
      try {
        const ms = parseTimecode(value);
        onPatch({ [field]: ms });
      } catch {
        // ignore partial input
      }
    },
    [onPatch],
  );

  const nudge = (field: 'startMs' | 'endMs', deltaMs: number) => {
    onPatch({ [field]: Math.max(0, entry[field] + deltaMs) });
  };

  const handleSpeakerChange = (name: string) => {
    if (isMulti) return;
    onPatch({ text: joinSpeakerAndBody(name, body) }, `speaker:${entry.id}`);
  };

  const handleBodyChange = (newBody: string) => {
    if (isMulti) {
      onPatch({ text: newBody }, `text:${entry.id}`);
      return;
    }
    onPatch({ text: joinSpeakerAndBody(speaker, newBody) }, `text:${entry.id}`);
  };

  const cps = computeCps(entry, excludeSpeakerTagFromCps);
  const color = cpsColor(cps, cpsThreshold);
  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarn = issues.some((i) => i.severity === 'warn');
  const rowClass =
    'segment-row' +
    (active ? ' active' : '') +
    (selected ? ' selected' : '') +
    (hasError ? ' has-error' : hasWarn ? ' has-warn' : '');

  return (
    <div className={rowClass} onFocus={onFocus} onClick={onFocus}>
      <div className="seq">
        <div>
          {selected && <span className="sel-mark" title="選択中">●</span>}
          {active && !selected && <span className="act-mark" title="再生中">▶</span>}
          #{index + 1}
        </div>
        <div className="cps-badge" style={{ background: color }} title={`${cps.toFixed(1)} CPS`}>
          {cps.toFixed(1)}
        </div>
        <button className="jump" onClick={(e) => { e.stopPropagation(); onJump(); }} title="この時刻へジャンプ">▶</button>
      </div>
      <div className="body">
        <div className="times">
          <button className="nudge" onClick={() => nudge('startMs', -100)} title="開始 -0.1秒">−.1</button>
          <button className="nudge" onClick={() => nudge('startMs', -1000)}>−1</button>
          <input
            className="tc"
            value={formatTimecode(entry.startMs)}
            onChange={(e) => handleTcChange('startMs', e.target.value)}
            onFocus={onFocus}
          />
          <button className="nudge" onClick={() => nudge('startMs', 100)}>+.1</button>
          <button className="nudge" onClick={() => nudge('startMs', 1000)}>+1</button>
          <button className="nudge set-cur" onClick={onSetInFromCurrent} title="現在の動画位置を開始に設定 (I)">I</button>
          <span className="arrow">→</span>
          <button className="nudge" onClick={() => nudge('endMs', -100)}>−.1</button>
          <input
            className="tc"
            value={formatTimecode(entry.endMs)}
            onChange={(e) => handleTcChange('endMs', e.target.value)}
            onFocus={onFocus}
          />
          <button className="nudge" onClick={() => nudge('endMs', 100)}>+.1</button>
          <button className="nudge" onClick={() => nudge('endMs', 1000)}>+1</button>
          <button className="nudge set-cur" onClick={onSetOutFromCurrent} title="現在の動画位置を終了に設定 (O)">O</button>
        </div>

        <div className="speaker-row">
          <label className="speaker-label">話者</label>
          <input
            className="speaker-input"
            value={isMulti ? '（複数話者）' : speaker}
            onChange={(e) => handleSpeakerChange(e.target.value)}
            placeholder="話者名(空欄可)"
            disabled={isMulti}
            onFocus={onFocus}
          />
          {isMulti && (
            <span className="speaker-multi-note">
              複数話者のため、下の欄で `（名前）セリフ` 形式のまま編集
            </span>
          )}
        </div>

        <textarea
          ref={textRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          onFocus={onFocus}
          placeholder={isMulti ? '（話者1）セリフ1\n（話者2）セリフ2' : 'セリフ'}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              // 話者タグを含めた元テキスト上のカーソル位置に変換
              const bodyStart = isMulti ? 0 : (speaker ? `（${speaker}）`.length : 0);
              const pos = (textRef.current?.selectionStart ?? 0) + bodyStart;
              onSplitAtCursor(pos);
            }
          }}
        />
        {issues.length > 0 && (
          <div className="row-issues">
            {issues.map((i, k) => (
              <span key={k} className={`issue-chip issue-${i.severity}`}>
                {i.message}
              </span>
            ))}
          </div>
        )}
        <div className="row-actions">
          <button onClick={onMergeNext} title="次の行と結合">▲結合</button>
          <button className="danger" onClick={onDelete} title="この行を削除">削除</button>
        </div>
      </div>
    </div>
  );
});
