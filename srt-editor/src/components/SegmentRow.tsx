import { memo, useCallback } from 'react';
import type { SrtEntry } from '../types';
import { formatTimecode, parseTimecode } from '../lib/time';

type Props = {
  entry: SrtEntry;
  index: number;
  active: boolean;
  onPatch: (patch: Partial<SrtEntry>) => void;
  onJump: () => void;
  onFocus: () => void;
};

export const SegmentRow = memo(function SegmentRow({
  entry, index, active, onPatch, onJump, onFocus,
}: Props) {
  const handleTcChange = useCallback(
    (field: 'startMs' | 'endMs', value: string) => {
      try {
        const ms = parseTimecode(value);
        onPatch({ [field]: ms });
      } catch {
        // ignore invalid input during typing
      }
    },
    [onPatch],
  );

  const nudge = (field: 'startMs' | 'endMs', deltaMs: number) => {
    onPatch({ [field]: Math.max(0, entry[field] + deltaMs) });
  };

  return (
    <div className={`segment-row ${active ? 'active' : ''}`} onFocus={onFocus}>
      <div className="seq">
        #{index + 1}
        <button className="jump" onClick={onJump} title="この時刻へジャンプ">▶ジャンプ</button>
      </div>
      <div className="body">
        <div className="times">
          <button className="nudge" onClick={() => nudge('startMs', -100)} title="開始 -0.1秒">−.1</button>
          <button className="nudge" onClick={() => nudge('startMs', -1000)} title="開始 -1秒">−1</button>
          <input
            className="tc"
            value={formatTimecode(entry.startMs)}
            onChange={(e) => handleTcChange('startMs', e.target.value)}
          />
          <button className="nudge" onClick={() => nudge('startMs', 100)}>+.1</button>
          <button className="nudge" onClick={() => nudge('startMs', 1000)}>+1</button>
          <span className="arrow">→</span>
          <button className="nudge" onClick={() => nudge('endMs', -100)}>−.1</button>
          <input
            className="tc"
            value={formatTimecode(entry.endMs)}
            onChange={(e) => handleTcChange('endMs', e.target.value)}
          />
          <button className="nudge" onClick={() => nudge('endMs', 100)}>+.1</button>
          <button className="nudge" onClick={() => nudge('endMs', 1000)}>+1</button>
        </div>
        <textarea
          value={entry.text}
          onChange={(e) => onPatch({ text: e.target.value })}
        />
      </div>
    </div>
  );
});
