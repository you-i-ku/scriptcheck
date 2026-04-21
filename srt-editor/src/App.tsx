import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { VideoPlayer, type VideoHandle } from './components/VideoPlayer';
import { Waveform } from './components/Waveform';
import { SegmentList } from './components/SegmentList';
import { decodeSrt, encodeSrt } from './lib/encoding';
import { parseSrt, serializeSrt } from './lib/srt';
import { saveSession, loadLatestSession, deleteSession } from './lib/storage';
import type { SrtEntry, SrtEncoding, SessionSnapshot } from './types';

function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [srtName, setSrtName] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<SrtEncoding>('utf-8-sig');
  const [entries, setEntries] = useState<SrtEntry[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SessionSnapshot | null>(null);

  const videoRef = useRef<VideoHandle>(null);
  const sessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Pick up video element after mount for waveform
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = videoRef.current?.getElement() ?? null;
      setVideoEl((cur) => (cur === el ? cur : el));
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  // Auto-track active segment from currentMs
  useEffect(() => {
    if (entries.length === 0) return;
    const hit = entries.find((e) => currentMs >= e.startMs && currentMs <= e.endMs);
    if (hit && hit.id !== activeSegmentId) setActiveSegmentId(hit.id);
  }, [currentMs, entries, activeSegmentId]);

  // Debounced auto-save
  useEffect(() => {
    if (!srtName || entries.length === 0 || !sessionIdRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus('…保存中');
    saveTimerRef.current = window.setTimeout(() => {
      saveSession({
        id: sessionIdRef.current!,
        srtFilename: srtName,
        videoFilename: videoName ?? undefined,
        encoding,
        entries,
      })
        .then(() => setSaveStatus('保存済'))
        .catch(() => setSaveStatus('保存失敗'));
    }, 800);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [entries, encoding, srtName, videoName]);

  const handleLoadVideo = useCallback((file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
  }, [videoUrl]);

  const handleLoadSrt = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const { text, encoding: enc } = decodeSrt(buf);
    const parsed = parseSrt(text);
    setEncoding(enc);
    setSrtName(file.name);
    setEntries(parsed);
    sessionIdRef.current = file.name;
    setActiveSegmentId(parsed[0]?.id ?? null);

    const latest = await loadLatestSession();
    if (latest && latest.srtFilename === file.name && latest.entries.length > 0) {
      setPendingRestore(latest);
    }
  }, []);

  const handlePatch = useCallback((id: string, patch: Partial<SrtEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const handleJumpTo = useCallback((id: string) => {
    const target = entries.find((e) => e.id === id);
    if (!target) return;
    videoRef.current?.seek(target.startMs);
    setActiveSegmentId(id);
  }, [entries]);

  const handleWaveformSeek = useCallback((ms: number) => {
    videoRef.current?.seek(ms);
  }, []);

  const handleExportSrt = useCallback(() => {
    if (!srtName) return;
    const text = serializeSrt(entries);
    const bytes = encodeSrt(text, encoding);
    const blob = new Blob([new Uint8Array(bytes)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = srtName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [entries, encoding, srtName]);

  const handleExportPdf = useCallback(async () => {
    if (!srtName || entries.length === 0) return;
    setPdfBusy(true);
    try {
      const { generatePdf } = await import('./lib/pdf');
      const pdfBytes = await generatePdf(entries);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date();
      const datestr =
        `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const stem = srtName.replace(/\.srt$/i, '');
      a.href = url;
      a.download = `${datestr}_${stem}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }, [entries, srtName]);

  const handleRestoreAccept = useCallback(() => {
    if (!pendingRestore) return;
    setEntries(pendingRestore.entries);
    setEncoding(pendingRestore.encoding);
    setPendingRestore(null);
  }, [pendingRestore]);

  const handleRestoreReject = useCallback(async () => {
    if (!pendingRestore) return;
    await deleteSession(pendingRestore.id);
    setPendingRestore(null);
  }, [pendingRestore]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (e.code === 'Space' && !inField) {
        e.preventDefault();
        videoRef.current?.togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const footerInfo = useMemo(() => {
    const sec = (currentMs / 1000).toFixed(2);
    return `現在: ${sec}s | セグメント: ${entries.length}件`;
  }, [currentMs, entries.length]);

  return (
    <div className="app">
      <Toolbar
        videoName={videoName}
        srtName={srtName}
        encoding={encoding}
        saveStatus={saveStatus}
        hasEntries={entries.length > 0}
        onLoadVideo={handleLoadVideo}
        onLoadSrt={handleLoadSrt}
        onExportSrt={handleExportSrt}
        onExportPdf={handleExportPdf}
        pdfBusy={pdfBusy}
      />

      {pendingRestore && (
        <div className="restore-banner">
          <span>前回「{pendingRestore.srtFilename}」の編集が見つかった。復帰する？</span>
          <button onClick={handleRestoreAccept}>復帰する</button>
          <button onClick={handleRestoreReject}>破棄して新規</button>
        </div>
      )}

      <div className="main">
        <div className="left-pane">
          <div className="video-wrap">
            <VideoPlayer ref={videoRef} src={videoUrl} onTimeUpdate={setCurrentMs} />
          </div>
          <Waveform
            videoEl={videoEl}
            entries={entries}
            activeSegmentId={activeSegmentId}
            onSeek={handleWaveformSeek}
          />
        </div>
        <SegmentList
          entries={entries}
          activeSegmentId={activeSegmentId}
          onPatch={handlePatch}
          onJumpTo={handleJumpTo}
          onActivate={setActiveSegmentId}
        />
      </div>

      <div className="footer-status">
        <span>{footerInfo}</span>
        <span style={{ marginLeft: 'auto' }}>Space=再生/停止</span>
      </div>
    </div>
  );
}

export default App;
