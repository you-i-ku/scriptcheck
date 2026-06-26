import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { SrtEntry } from '../types';
import { formatTimecode, parseTimecode } from '../lib/time';
import { computeCps, cpsColor, type QcIssue } from '../lib/qc';
import {
  parseSpeakerPairs, serializeSpeakerPairs, type SpeakerPair,
} from '../lib/srt';

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
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onSplitAtCursor: (charIndex: number) => void;
  onSetInFromCurrent: () => void;
  onSetOutFromCurrent: () => void;
};

export const SegmentRow = memo(function SegmentRow({
  entry, index, active, selected, issues,
  cpsThreshold, excludeSpeakerTagFromCps,
  onPatch, onJump, onFocus, onDelete, onMergeNext, onSplitAtCursor,
  onMoveUp, onMoveDown, onDuplicate,
  onSetInFromCurrent, onSetOutFromCurrent,
}: Props) {
  // ローカル state でペア管理(空ペア追加が外部再parseで消えないように)
  const [pairs, setPairs] = useState<SpeakerPair[]>(() => parseSpeakerPairs(entry.text));
  const prevIdRef = useRef(entry.id);

  // 外部(undo/redo/別エントリ)から text が変わったら再同期
  useEffect(() => {
    const filtered = pairs.filter((p) => p.name || p.text);
    const currentSerialized = serializeSpeakerPairs(
      filtered.length > 0 ? filtered : [{ name: '', text: '' }],
    );
    if (entry.id !== prevIdRef.current || entry.text !== currentSerialized) {
      prevIdRef.current = entry.id;
      setPairs(parseSpeakerPairs(entry.text));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, entry.text]);

  const commitPairs = useCallback(
    (newPairs: SpeakerPair[], coalesceKey?: string) => {
      setPairs(newPairs);
      const filtered = newPairs.filter((p) => p.name || p.text);
      const newText = filtered.length > 0
        ? serializeSpeakerPairs(filtered)
        : '';
      onPatch({ text: newText }, coalesceKey);
    },
    [onPatch],
  );

  const handlePairName = (i: number, name: string) => {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, name } : p));
    commitPairs(next, `speaker:${entry.id}:${i}`);
  };

  const handlePairText = (i: number, text: string) => {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, text } : p));
    commitPairs(next, `dialogue:${entry.id}:${i}`);
  };

  const addPair = () => {
    setPairs((prev) => [...prev, { name: '', text: '' }]);
    // dispatch は空ペアなので commit しない — 入力が入った時点で反映される
  };

  const removePair = (i: number) => {
    if (pairs.length <= 1) {
      commitPairs([{ name: '', text: '' }]);
      return;
    }
    const next = pairs.filter((_, idx) => idx !== i);
    commitPairs(next);
  };

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
    (selected ? ' selected' : '') +
    (hasError ? ' has-error' : hasWarn ? ' has-warn' : '');

  return (
    <div className={rowClass} onFocus={onFocus} onClick={onFocus}>
      <div className="seq">
        <div className="seq-head">
          <span className="mark-slot">
            {selected
              ? <span className="sel-mark" title="選択中">●</span>
              : active
                ? <span className="act-mark" title="再生中">▶</span>
                : null}
          </span>
          <span className="seq-num">#{index + 1}</span>
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

        <div className="speaker-pairs">
          {pairs.map((p, i) => (
            <SpeakerPairInput
              key={`${entry.id}-${i}`}
              pair={p}
              canDelete={pairs.length > 1}
              onNameChange={(v) => handlePairName(i, v)}
              onTextChange={(v) => handlePairText(i, v)}
              onDelete={() => removePair(i)}
              onInsertLineBreak={(pos) => {
                const nextText = `${p.text.slice(0, pos)}\n${p.text.slice(pos)}`;
                handlePairText(i, nextText);
              }}
              onSplitAtCursor={(pos) => {
                // 全体テキスト上のカーソル位置を計算
                let offset = 0;
                for (let j = 0; j < i; j += 1) {
                  offset += (pairs[j].name ? `（${pairs[j].name.trim()}）`.length : 0);
                  offset += pairs[j].text.length + 1; // +1 for newline
                }
                offset += (p.name ? `（${p.name.trim()}）`.length : 0);
                onSplitAtCursor(offset + pos);
              }}
              onFocus={onFocus}
            />
          ))}
        </div>

        {issues.length > 0 && (
          <div className="row-issues">
            {issues.map((isu, k) => (
              <span key={k} className={`issue-chip issue-${isu.severity}`}>
                {isu.message}
              </span>
            ))}
          </div>
        )}
        <div className="row-actions">
          <button onClick={addPair} title="このセグメントに話者を追加">＋話者</button>
          <button onClick={onMoveUp} title="このセグメントを上へ移動">↑</button>
          <button onClick={onMoveDown} title="このセグメントを下へ移動">↓</button>
          <button onClick={onDuplicate} title="このセグメントを複製">複製</button>
          <button onClick={onMergeNext} title="次の行と結合">結合</button>
          <button className="danger" onClick={onDelete} title="この行を削除">削除</button>
        </div>
      </div>
    </div>
  );
});

function SpeakerPairInput({
  pair, canDelete, onNameChange, onTextChange, onDelete, onInsertLineBreak, onSplitAtCursor, onFocus,
}: {
  pair: SpeakerPair;
  canDelete: boolean;
  onNameChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onDelete: () => void;
  onInsertLineBreak: (pos: number) => void;
  onSplitAtCursor: (pos: number) => void;
  onFocus: () => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="speaker-pair">
      <label className="speaker-label">話者</label>
      <input
        className="speaker-input"
        value={pair.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="(空欄可)"
        onFocus={onFocus}
      />
      <textarea
        ref={textRef}
        className="pair-dialogue"
        value={pair.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="セリフ"
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.altKey && e.key === 'Enter') {
            e.preventDefault();
            const pos = textRef.current?.selectionStart ?? 0;
            onInsertLineBreak(pos);
          } else if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const pos = textRef.current?.selectionStart ?? 0;
            onSplitAtCursor(pos);
          }
        }}
      />
      <button
        className="pair-linebreak"
        onClick={(e) => {
          e.stopPropagation();
          const pos = textRef.current?.selectionStart ?? pair.text.length;
          onInsertLineBreak(pos);
          window.setTimeout(() => textRef.current?.focus(), 0);
        }}
        title="カーソル位置に改行を挿入"
      >
        改行
      </button>
      <button
        className="pair-delete danger"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={!canDelete}
        title={canDelete ? 'この話者行を削除' : '最後のひとつは削除不可'}
      >
        ✕
      </button>
    </div>
  );
}
