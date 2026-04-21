import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import type { SrtEntry } from '../types';

type Props = {
  videoEl: HTMLVideoElement | null;
  entries: SrtEntry[];
  activeSegmentId: string | null;
  onSeek?: (ms: number) => void;
};

export function Waveform({ videoEl, entries, activeSegmentId, onSeek }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

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
      if (onSeek) onSeek(Math.round(ws.getCurrentTime() * 1000));
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
  }, [videoEl, onSeek]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions) return;
    regions.clearRegions();
    for (const e of entries) {
      regions.addRegion({
        id: e.id,
        start: e.startMs / 1000,
        end: e.endMs / 1000,
        color: e.id === activeSegmentId
          ? 'rgba(0, 136, 238, 0.35)'
          : 'rgba(120, 120, 120, 0.15)',
        drag: false,
        resize: false,
      });
    }
  }, [entries, activeSegmentId]);

  return (
    <div className="waveform-wrap">
      <div ref={containerRef} className="waveform-container" />
    </div>
  );
}
