import { useEffect, useRef } from 'react';
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
  onSeek?: (ms: number) => void;
  onInsertAt?: (startMs: number, endMs: number) => void;
  onRegionMove?: (id: string, startMs: number, endMs: number) => void;
};

const MIN_PX_PER_SEC = 10;
const MAX_PX_PER_SEC = 400;
const DEFAULT_PX_PER_SEC = 50;

export function Waveform({
  videoEl, entries, activeSegmentId, selectedSegmentId, uncovered,
  onSeek, onInsertAt, onRegionMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const handlersRef = useRef({ onSeek, onInsertAt, onRegionMove });
  const draggingRef = useRef<string | null>(null);
  const zoomRef = useRef<number>(DEFAULT_PX_PER_SEC);

  useEffect(() => {
    handlersRef.current = { onSeek, onInsertAt, onRegionMove };
  }, [onSeek, onInsertAt, onRegionMove]);

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
      dragToSeek: { debounceTime: 10 },
      autoScroll: true,
      plugins: [regions],
    });
    wsRef.current = ws;

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

    // ドラッグ中: 動画カーソルをリアルタイム追従させる(commit はしない)
    regions.on('region-update', (region) => {
      if (region.id.startsWith('uncovered:')) return;
      draggingRef.current = region.id;
      if (videoEl) videoEl.currentTime = region.start;
    });

    // ドラッグ終了: 編集commit
    regions.on('region-updated', (region) => {
      if (region.id.startsWith('uncovered:')) return;
      draggingRef.current = null;
      handlersRef.current.onRegionMove?.(
        region.id,
        Math.round(region.start * 1000),
        Math.round(region.end * 1000),
      );
    });

    // Ctrl+ホイールでズーム
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

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;
    // ドラッグ中はリージョン再構築しない(ドラッグが消える)
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
      // 選択中=濃い橙、再生中=薄い青、両方=橙優先、それ以外=薄グレー
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

  return (
    <div className="waveform-wrap">
      <div ref={containerRef} className="waveform-container" />
    </div>
  );
}
