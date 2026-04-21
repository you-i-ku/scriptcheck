import { memo, useCallback, useRef } from 'react';
import type { SrtEntry } from '../types';
import { formatTimecode, parseTimecode } from '../lib/time';
import { computeCps, cpsColor, type QcIssue } from '../lib/qc';

type Props = {
  entry: SrtEntry;
  index: number;
  active: boolean;
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

export const SegmentRow = memo(function SegmentRow({
  entry, index, active, issues,
  cpsThreshold, excludeSpeakerTagFromCps,
  onPatch, onJump, onFocus, onDelete, onMergeNext, onSplitAtCursor,
  onSetInFromCurrent, onSetOutFromCurrent,
}: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);

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

  const cps = computeCps(entry, excludeSpeakerTagFromCps);
  const color = cpsColor(cps, cpsThreshold);
  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarn = issues.some((i) => i.severity === 'warn');
  const rowClass =
    'segment-row' +
    (active ? ' active' : '') +
    (hasError ? ' has-error' : hasWarn ? ' has-warn' : '');

  return (
    <div className={rowClass} onFocus={onFocus}>
      <div className="seq">
        <div>#{index + 1}</div>
        <div className="cps-badge" style={{ background: color }} title={`${cps.toFixed(1)} CPS`}>
          {cps.toFixed(1)}
        </div>
        <button className="jump" onClick={onJump} title="この時刻へジャンプ">▶</button>
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
        <textarea
          ref={textRef}
          value={entry.text}
          onChange={(e) => onPatch({ text: e.target.value }, `text:${entry.id}`)}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              const pos = textRef.current?.selectionStart ?? 0;
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
