import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import type { SrtEntry } from '../types';
import type { SpeechRegion } from '../lib/silence';

type Props = {
  videoEl: HTMLVideoElement | null;
  entries: SrtEntry[];
  activeSegmentId: string | null;
  selectedSegmentId: string | null;
  uncovered: SpeechRegion[];
  currentMs: number;
  onSeek?: (ms: number) => void;
  onInsertAt?: (startMs: number, endMs: number) => void;
  onRegionMove?: (id: string, startMs: number, endMs: number) => void;
};

const MIN_PX_PER_SEC = 10;
const MAX_PX_PER_SEC = 400;
const DEFAULT_PX_PER_SEC = 50;

export function Waveform({
  videoEl, entries, activeSegmentId, selectedSegmentId, uncovered, currentMs,
  onSeek, onInsertAt, onRegionMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const handlersRef = useRef({ onSeek, onInsertAt, onRegionMove });
  const draggingRef = useRef<string | null>(null);
  const zoomRef = useRef<number>(DEFAULT_PX_PER_SEC);
  const [durationMs, setDurationMs] = useState(0);
  const [scrubDragging, setScrubDragging] = useState(false);

  useEffect(() => {
    handlersRef.current = { onSeek, onInsertAt, onRegionMove };
  }, [onSeek, onInsertAt, onRegionMove]);

  // Waveform セットアップ
  useEffect(() => {
    if (!videoEl || !containerRef.current) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#555',
      progressColor: '#0088ee',
      cursorColor: '#fff',
      height: 80,
      media: videoEl,
      minPxPerSec: DEFAULT_PX_PER_SEC,
      autoScroll: true,
      dragToSeek: false,
      plugins: [regions],
    });
    wsRef.current = ws;

    const onReady = () => setDurationMs(Math.round(ws.getDuration() * 1000));
    ws.on('ready', onReady);

    // 波形自体をクリックしたときのシーク(ドラッグはしない)
    ws.on('interaction', () => {
      handlersRef.current.onSeek?.(Math.round(ws.getCurrentTime() * 1000));
    });

    regions.on('region-clicked', (region, ev) => {
      ev.stopPropagation();
      if (region.id.startsWith('uncovered:')) {
        handlersRef.current.onInsertAt?.(
          Math.round(region.start * 1000),
          Math.round(region.end * 1000),
        );
      } else {
        handlersRef.current.onSeek?.(Math.round(region.start * 1000));
      }
    });

    regions.on('region-update', (region) => {
      if (region.id.startsWith('uncovered:')) return;
      draggingRef.current = region.id;
      if (videoEl) videoEl.currentTime = region.start;
    });

    regions.on('region-updated', (region) => {
      if (region.id.startsWith('uncovered:')) return;
      draggingRef.current = null;
      handlersRef.current.onRegionMove?.(
        region.id,
        Math.round(region.start * 1000),
        Math.round(region.end * 1000),
      );
    });

    const containerEl = containerRef.current;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      const next = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, zoomRef.current * factor));
      if (next !== zoomRef.current) {
        zoomRef.current = next;
        ws.zoom(next);
      }
    };
    containerEl.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      containerEl.removeEventListener('wheel', onWheel);
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
      draggingRef.current = null;
    };
  }, [videoEl]);

  // リージョン再描画
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;
    if (draggingRef.current !== null) return;

    regions.clearRegions();

    for (const u of uncovered) {
      regions.addRegion({
        id: `uncovered:${u.startMs}`,
        start: u.startMs / 1000,
        end: u.endMs / 1000,
        color: 'rgba(255, 169, 64, 0.35)',
        drag: false,
        resize: false,
      });
    }

    for (const e of entries) {
      const isSelected = e.id === selectedSegmentId;
      const isActive = e.id === activeSegmentId;
      const color = isSelected
        ? 'rgba(255, 165, 0, 0.45)'
        : isActive
          ? 'rgba(90, 183, 255, 0.25)'
          : 'rgba(120, 120, 120, 0.12)';
      regions.addRegion({
        id: e.id,
        start: e.startMs / 1000,
        end: e.endMs / 1000,
        color,
        drag: true,
        resize: true,
      });
    }
  }, [entries, activeSegmentId, selectedSegmentId, uncovered]);

  // スクラブストリップのマウス操作
  useEffect(() => {
    if (!scrubDragging) return;
    const onMove = (e: MouseEvent) => updateScrub(e.clientX);
    const onUp = () => setScrubDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubDragging]);

  const updateScrub = (clientX: number) => {
    if (!scrubRef.current || !videoEl || durationMs === 0) return;
    const rect = scrubRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const timeS = frac * (videoEl.duration || 0);
    videoEl.currentTime = timeS;
  };

  const playheadPct = durationMs > 0 ? (currentMs / durationMs) * 100 : 0;

  return (
    <div className="waveform-wrap">
      <div
        ref={scrubRef}
        className="scrub-strip"
        onMouseDown={(e) => {
          setScrubDragging(true);
          updateScrub(e.clientX);
        }}
        title="ドラッグ or クリックで動画シーク"
      >
        <div className="scrub-label">▶ シーク</div>
        <div
          className="scrub-playhead"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
      <div ref={containerRef} className="waveform-container" />
    </div>
  );
}
