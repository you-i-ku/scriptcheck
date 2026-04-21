import { useEffect, useRef } from 'react';
import type { SrtEntry } from '../types';
import { SegmentRow } from './SegmentRow';

type Props = {
  entries: SrtEntry[];
  activeSegmentId: string | null;
  onPatch: (id: string, patch: Partial<SrtEntry>) => void;
  onJumpTo: (id: string) => void;
  onActivate: (id: string) => void;
};

export function SegmentList({ entries, activeSegmentId, onPatch, onJumpTo, onActivate }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevActive = useRef<string | null>(null);

  useEffect(() => {
    if (activeSegmentId === prevActive.current) return;
    prevActive.current = activeSegmentId;
    if (!activeSegmentId || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-id="${CSS.escape(activeSegmentId)}"]`
    );
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSegmentId]);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>SRTファイルを読み込んでください。</p>
        <p style={{ fontSize: 12 }}>動画 + SRT → 波形上で校正 → エクスポートの流れで使うで。</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="segment-list">
      {entries.map((e, i) => (
        <div key={e.id} data-id={e.id}>
          <SegmentRow
            entry={e}
            index={i}
            active={e.id === activeSegmentId}
            onPatch={(patch) => onPatch(e.id, patch)}
            onJump={() => onJumpTo(e.id)}
            onFocus={() => onActivate(e.id)}
          />
        </div>
      ))}
    </div>
  );
}
