import { Fragment, useEffect, useRef } from 'react';
import type { SrtEntry } from '../types';
import { SegmentRow } from './SegmentRow';
import type { IssuesByEntry } from '../lib/qc';

type Props = {
  entries: SrtEntry[];
  activeSegmentId: string | null;
  selectedSegmentId: string | null;
  autoScrollEnabled: boolean;
  issuesByEntry: IssuesByEntry;
  cpsThreshold: number;
  excludeSpeakerTagFromCps: boolean;
  onPatch: (id: string, patch: Partial<SrtEntry>, coalesceKey?: string) => void;
  onJumpTo: (id: string) => void;
  onActivate: (id: string) => void;
  onInsertAfter: (id: string | null) => void;
  onDelete: (id: string) => void;
  onMergeNext: (id: string) => void;
  onSplitAtCursor: (id: string, charIndex: number) => void;
  onSetIn: (id: string) => void;
  onSetOut: (id: string) => void;
};

export function SegmentList({
  entries, activeSegmentId, selectedSegmentId, autoScrollEnabled, issuesByEntry,
  cpsThreshold, excludeSpeakerTagFromCps,
  onPatch, onJumpTo, onActivate, onInsertAfter,
  onDelete, onMergeNext, onSplitAtCursor, onSetIn, onSetOut,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevSelected = useRef<string | null>(null);
  const prevActive = useRef<string | null>(null);

  useEffect(() => {
    // 選択中が変わったら最優先でそこにスクロール(ユーザーの明示的操作なので常時)
    if (selectedSegmentId !== prevSelected.current) {
      prevSelected.current = selectedSegmentId;
      if (selectedSegmentId && listRef.current) {
        const node = listRef.current.querySelector<HTMLElement>(
          `[data-id="${CSS.escape(selectedSegmentId)}"]`,
        );
        node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }
    // 再生追従スクロール(OFFの時は抑制)
    if (!autoScrollEnabled) {
      prevActive.current = activeSegmentId;
      return;
    }
    if (activeSegmentId !== prevActive.current) {
      prevActive.current = activeSegmentId;
      if (activeSegmentId && listRef.current) {
        const node = listRef.current.querySelector<HTMLElement>(
          `[data-id="${CSS.escape(activeSegmentId)}"]`,
        );
        node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedSegmentId, activeSegmentId, autoScrollEnabled]);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>SRTファイルを読み込んでください</p>
        <p style={{ fontSize: 12 }}>動画 + SRT → 波形上で校正 → エクスポート</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="segment-list">
      <InsertBar onClick={() => onInsertAfter(null)} />
      {entries.map((e, i) => (
        <Fragment key={e.id}>
          <div data-id={e.id}>
            <SegmentRow
              entry={e}
              index={i}
              active={e.id === activeSegmentId}
              selected={e.id === selectedSegmentId}
              issues={issuesByEntry[e.id] ?? []}
              cpsThreshold={cpsThreshold}
              excludeSpeakerTagFromCps={excludeSpeakerTagFromCps}
              onPatch={(patch, key) => onPatch(e.id, patch, key)}
              onJump={() => onJumpTo(e.id)}
              onFocus={() => onActivate(e.id)}
              onDelete={() => onDelete(e.id)}
              onMergeNext={() => onMergeNext(e.id)}
              onSplitAtCursor={(pos) => onSplitAtCursor(e.id, pos)}
              onSetInFromCurrent={() => onSetIn(e.id)}
              onSetOutFromCurrent={() => onSetOut(e.id)}
            />
          </div>
          <InsertBar onClick={() => onInsertAfter(e.id)} />
        </Fragment>
      ))}
    </div>
  );
}

function InsertBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="insert-bar" onClick={onClick} title="ここに新規セグメントを挿入">
      <span>+</span>
    </div>
  );
}
