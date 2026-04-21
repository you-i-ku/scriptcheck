import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import type { SrtEntry } from '../types';
import type { SpeechRegion } from '../lib/silence';

type Props = {
  videoEl: HTMLVideoElement | null;
  entries: SrtEntry[];
  activeSegmentId: string | null;
  uncovered: SpeechRegion[];
  onSeek?: (ms: number) => void;
  onInsertAt?: (startMs: number, endMs: number) => void;
};

export function Waveform({
  videoEl, entries, activeSegmentId, uncovered, onSeek, onInsertAt,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const handlersRef = useRef({ onSeek, onInsertAt });

  useEffect(() => {
    handlersRef.current = { onSeek, onInsertAt };
  }, [onSeek, onInsertAt]);

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

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
  }, [videoEl]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;
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
      regions.addRegion({
        id: e.id,
        start: e.startMs / 1000,
        end: e.endMs / 1000,
        color: e.id === activeSegmentId
          ? 'rgba(0, 136, 238, 0.35)'
          : 'rgba(120, 120, 120, 0.12)',
        drag: false,
        resize: false,
      });
    }
  }, [entries, activeSegmentId, uncovered]);

  return (
    <div className="waveform-wrap">
      <div ref={containerRef} className="waveform-container" />
    </div>
  );
}
