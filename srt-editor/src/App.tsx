import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { VideoPlayer, type VideoHandle } from './components/VideoPlayer';
import { Waveform } from './components/Waveform';
import { SegmentList } from './components/SegmentList';
import { HelpPanel } from './components/HelpPanel';
import { QcPanel } from './components/QcPanel';
import { TimeshiftDialog } from './components/TimeshiftDialog';
import { FindReplaceDialog } from './components/FindReplaceDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { decodeSrt, encodeSrt } from './lib/encoding';
import { parseSrt, serializeSrt } from './lib/srt';
import { saveSession, loadLatestSession, loadSession, deleteSession } from './lib/storage';
import {
  editorReducer, INITIAL_HISTORY, canUndo, canRedo,
  type EditorState,
} from './state/editorReducer';
import {
  DEFAULT_QC_OPTIONS, findIssues, groupIssuesByEntry, type QcOptions,
} from './lib/qc';
import {
  decodeVideoAudio, findUncoveredSpeechRegions, type SpeechRegion,
} from './lib/silence';
import type { SessionSnapshot } from './types';

const SETTINGS_KEY = 'srt-editor:qc-options';
const MANUAL_SESSION_ID_PREFIX = 'manual:';
const MIN_SEGMENT_DURATION_MS = 100;

function manualSessionId(id: string) {
  return `${MANUAL_SESSION_ID_PREFIX}${id}`;
}

function loadSettings(): QcOptions {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_QC_OPTIONS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_QC_OPTIONS;
}
function saveSettings(opts: QcOptions) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(opts)); } catch { /* ignore */ }
}

function App() {
  const [history, dispatch] = useReducer(editorReducer, INITIAL_HISTORY);
  const { entries, encoding, srtName } = history.present;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [silenceBusy, setSilenceBusy] = useState(false);
  const [uncovered, setUncovered] = useState<SpeechRegion[]>([]);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SessionSnapshot | null>(null);
  const [qcOptions, setQcOptions] = useState<QcOptions>(loadSettings);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const [modalHelp, setModalHelp] = useState(false);
  const [modalFind, setModalFind] = useState(false);
  const [modalTimeshift, setModalTimeshift] = useState(false);
  const [modalSettings, setModalSettings] = useState(false);
  const [showQcPanel, setShowQcPanel] = useState(false);

  const videoRef = useRef<VideoHandle>(null);
  const sessionIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const skipNextAutoSaveRef = useRef(false);

  // Video element tracking
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = videoRef.current?.getElement() ?? null;
      setVideoEl((cur) => (cur === el ? cur : el));
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  // Auto-track active from current time
  useEffect(() => {
    if (entries.length === 0) return;
    const hit = entries.find((e) => currentMs >= e.startMs && currentMs <= e.endMs);
    if (hit && hit.id !== activeSegmentId) setActiveSegmentId(hit.id);
  }, [currentMs, entries, activeSegmentId]);

  // Debounced auto-save
  useEffect(() => {
    if (pendingRestore) return;
    if (!srtName || entries.length === 0 || !sessionIdRef.current) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
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
        .then(() => {
          setSaveStatus('保存済');
        })
        .catch(() => setSaveStatus('保存失敗'));
    }, 800);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [entries, encoding, srtName, videoName, pendingRestore]);

  // QC issues
  const issues = useMemo(() => findIssues(entries, qcOptions), [entries, qcOptions]);
  const issuesByEntry = useMemo(() => groupIssuesByEntry(issues), [issues]);
  const issuesCount = useMemo(() => ({
    errors: issues.filter((i) => i.severity === 'error').length,
    warns: issues.filter((i) => i.severity === 'warn').length,
  }), [issues]);

  const handleLoadVideo = useCallback((file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
    setVideoFile(file);
    setUncovered([]);
  }, [videoUrl]);

  const handleLoadSrt = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    const { text, encoding: enc } = decodeSrt(buf);
    const parsed = parseSrt(text);
    const newState: EditorState = {
      entries: parsed,
      encoding: enc,
      srtName: file.name,
    };
    dispatch({ type: 'LOAD', payload: newState });
    sessionIdRef.current = file.name;
    const first = parsed[0]?.id ?? null;
    setActiveSegmentId(first);
    setSelectedSegmentId(first);

    const saved = await loadSession(file.name);
    if (saved && saved.entries.length > 0) {
      setPendingRestore(saved);
    }
  }, []);

  const handleSaveSession = useCallback(async () => {
    if (!srtName || entries.length === 0) return;
    const id = sessionIdRef.current ?? srtName;
    sessionIdRef.current = id;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveStatus('…保存中');
    try {
      await saveSession({
        id: manualSessionId(id),
        srtFilename: srtName,
        videoFilename: videoName ?? undefined,
        encoding,
        entries,
      });
      setSaveStatus('手動保存済');
    } catch {
      setSaveStatus('保存失敗');
    }
  }, [entries, encoding, srtName, videoName]);

  const restoreSessionSnapshot = useCallback((snapshot: SessionSnapshot) => {
    skipNextAutoSaveRef.current = true;
    dispatch({
      type: 'LOAD',
      payload: {
        entries: snapshot.entries,
        encoding: snapshot.encoding,
        srtName: snapshot.srtFilename,
      },
    });
    sessionIdRef.current = snapshot.srtFilename;
    setActiveSegmentId(snapshot.entries[0]?.id ?? null);
    setSelectedSegmentId(snapshot.entries[0]?.id ?? null);
    setPendingRestore(null);
    setSaveStatus('途中復帰済');
  }, []);

  const handleRestoreSession = useCallback(async () => {
    const currentId = sessionIdRef.current ?? srtName;
    const saved = currentId
      ? await loadSession(manualSessionId(currentId))
      : await loadLatestSession({ idPrefix: MANUAL_SESSION_ID_PREFIX });
    if (!saved || saved.entries.length === 0) {
      setSaveStatus('復帰データなし');
      return;
    }
    restoreSessionSnapshot(saved);
  }, [restoreSessionSnapshot, srtName]);

  const handlePatch = useCallback(
    (id: string, patch: Partial<SessionSnapshot['entries'][number]>, coalesceKey?: string) => {
      dispatch({ type: 'PATCH_ENTRY', id, patch, coalesceKey });
    },
    [],
  );

  const handleJumpTo = useCallback((id: string) => {
    const target = entries.find((e) => e.id === id);
    if (!target) return;
    videoRef.current?.seek(target.startMs);
    setSelectedSegmentId(id);
  }, [entries]);

  const handleWaveformSeek = useCallback((ms: number) => {
    videoRef.current?.seek(ms);
  }, []);

  const getCurrentVideoMs = useCallback(
    () => videoRef.current?.getCurrentMs() ?? currentMs,
    [currentMs],
  );

  const handleInsertAfter = useCallback((afterId: string | null) => {
    let startMs: number;
    let endMs: number;
    if (afterId === null) {
      const next = entries[0];
      startMs = 0;
      endMs = next ? Math.max(200, next.startMs - 200) : 2000;
    } else {
      const idx = entries.findIndex((e) => e.id === afterId);
      const prev = entries[idx];
      const next = entries[idx + 1];
      startMs = prev ? prev.endMs + 100 : 0;
      endMs = next ? Math.max(startMs + 200, next.startMs - 100) : startMs + 2000;
    }
    const newId = crypto.randomUUID();
    dispatch({
      type: 'INSERT_AFTER',
      afterId,
      newEntry: { id: newId, seq: 0, startMs, endMs, text: '' },
    });
    setSelectedSegmentId(newId);
  }, [entries]);

  const handleInsertAtCurrent = useCallback(() => {
    const newId = crypto.randomUUID();
    const startMs = getCurrentVideoMs();
    const endMs = startMs + 1500;
    dispatch({ type: 'INSERT_AT_TIME', startMs, endMs, newId });
    setSelectedSegmentId(newId);
  }, [getCurrentVideoMs]);

  const handleInsertAtRegion = useCallback((startMs: number, endMs: number) => {
    const newId = crypto.randomUUID();
    dispatch({ type: 'INSERT_AT_TIME', startMs, endMs, newId });
    setSelectedSegmentId(newId);
    setUncovered((prev) => prev.filter(
      (u) => u.startMs !== startMs || u.endMs !== endMs,
    ));
  }, []);

  const handleDelete = useCallback((id: string) => {
    dispatch({ type: 'DELETE', id });
    if (selectedSegmentId === id) setSelectedSegmentId(null);
  }, [selectedSegmentId]);

  const handleMergeNext = useCallback((id: string) => {
    dispatch({ type: 'MERGE_WITH_NEXT', id });
  }, []);

  const handleMove = useCallback((id: string, direction: -1 | 1) => {
    dispatch({ type: 'MOVE', id, direction });
    setSelectedSegmentId(id);
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    const newId = crypto.randomUUID();
    dispatch({ type: 'DUPLICATE', id, newId });
    setSelectedSegmentId(newId);
  }, []);

  const handleSplitAtCursor = useCallback((id: string, charIndex: number) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const mid = Math.floor((entry.startMs + entry.endMs) / 2);
    const currentVideoMs = getCurrentVideoMs();
    const timeMs = currentVideoMs > entry.startMs && currentVideoMs < entry.endMs
      ? currentVideoMs
      : mid;
    dispatch({ type: 'SPLIT', id, charIndex, timeMs, newId: crypto.randomUUID() });
  }, [entries, getCurrentVideoMs]);

  const handleSetIn = useCallback((id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const startMs = Math.max(0, getCurrentVideoMs());
    dispatch({
      type: 'PATCH_ENTRY',
      id,
      patch: {
        startMs,
        endMs: Math.max(entry.endMs, startMs + MIN_SEGMENT_DURATION_MS),
      },
    });
  }, [entries, getCurrentVideoMs]);

  const handleSetOut = useCallback((id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const endMs = Math.max(MIN_SEGMENT_DURATION_MS, getCurrentVideoMs());
    dispatch({
      type: 'PATCH_ENTRY',
      id,
      patch: {
        startMs: Math.min(entry.startMs, endMs - MIN_SEGMENT_DURATION_MS),
        endMs,
      },
    });
  }, [entries, getCurrentVideoMs]);

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
      const datestr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
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

  const handleDetectSilence = useCallback(async () => {
    if (!videoFile || entries.length === 0) return;
    setSilenceBusy(true);
    try {
      const audio = await decodeVideoAudio(videoFile);
      const gaps = findUncoveredSpeechRegions(audio, entries);
      setUncovered(gaps);
      if (gaps.length === 0) {
        alert('字幕カバー外の発話区間は見つからへんかった');
      }
    } catch (err) {
      alert(`無音解析エラー: ${(err as Error).message}`);
    } finally {
      setSilenceBusy(false);
    }
  }, [videoFile, entries]);

  const handleRestoreAccept = useCallback(() => {
    if (!pendingRestore) return;
    restoreSessionSnapshot(pendingRestore);
  }, [pendingRestore, restoreSessionSnapshot]);

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

      // Ctrl / Cmd modifiers — work everywhere
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); return; }
        if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); dispatch({ type: 'REDO' }); return; }
        if (e.key === 'f') { e.preventDefault(); setModalFind(true); return; }
        return;
      }

      // In-field: let native typing through
      if (inField) return;

      if (e.code === 'Space') {
        e.preventDefault();
        videoRef.current?.togglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        videoRef.current?.seek(Math.max(0, getCurrentVideoMs() - 2000));
      } else if (e.key === 'l' || e.key === 'L') {
        videoRef.current?.seek(getCurrentVideoMs() + 2000);
      } else if (e.key === '[') {
        const sorted = [...entries].sort((a, b) => a.startMs - b.startMs);
        const anchorId = selectedSegmentId ?? activeSegmentId;
        const idx = sorted.findIndex((ee) => ee.id === anchorId);
        const target = sorted[Math.max(0, idx - 1)];
        if (target) { videoRef.current?.seek(target.startMs); setSelectedSegmentId(target.id); }
      } else if (e.key === ']') {
        const sorted = [...entries].sort((a, b) => a.startMs - b.startMs);
        const anchorId = selectedSegmentId ?? activeSegmentId;
        const idx = sorted.findIndex((ee) => ee.id === anchorId);
        const target = sorted[Math.min(sorted.length - 1, idx + 1)];
        if (target) { videoRef.current?.seek(target.startMs); setSelectedSegmentId(target.id); }
      } else if ((e.key === 'i' || e.key === 'I') && selectedSegmentId) {
        handleSetIn(selectedSegmentId);
      } else if ((e.key === 'o' || e.key === 'O') && selectedSegmentId) {
        handleSetOut(selectedSegmentId);
      } else if (e.key === 'n' || e.key === 'N') {
        handleInsertAtCurrent();
      } else if (e.key === '?') {
        setModalHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSegmentId, selectedSegmentId, entries, getCurrentVideoMs, handleSetIn, handleSetOut, handleInsertAtCurrent]);

  // Settings persistence
  useEffect(() => { saveSettings(qcOptions); }, [qcOptions]);

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
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        pdfBusy={pdfBusy}
        silenceBusy={silenceBusy}
        onLoadVideo={handleLoadVideo}
        onLoadSrt={handleLoadSrt}
        onSaveSession={handleSaveSession}
        onRestoreSession={handleRestoreSession}
        onExportSrt={handleExportSrt}
        onExportPdf={handleExportPdf}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onRedo={() => dispatch({ type: 'REDO' })}
        onOpenFind={() => setModalFind(true)}
        onOpenTimeshift={() => setModalTimeshift(true)}
        onOpenSettings={() => setModalSettings(true)}
        onOpenHelp={() => setModalHelp(true)}
        onToggleQcPanel={() => setShowQcPanel((v) => !v)}
        onDetectSilence={handleDetectSilence}
        issuesCount={issuesCount}
        hasSilenceResults={uncovered.length > 0}
        autoScrollEnabled={autoScrollEnabled}
        onToggleAutoScroll={() => setAutoScrollEnabled((v) => !v)}
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
            selectedSegmentId={selectedSegmentId}
            uncovered={uncovered}
            currentMs={currentMs}
            onSeek={handleWaveformSeek}
            onInsertAt={handleInsertAtRegion}
            onRegionMove={(id, startMs, endMs) =>
              dispatch({ type: 'PATCH_ENTRY', id, patch: { startMs, endMs } })
            }
          />
          <div className="hint-bar">
            再生 <kbd>Space</kbd> / 前後2秒 <kbd>J</kbd><kbd>L</kbd> / 前後セグ <kbd>[</kbd><kbd>]</kbd> /
            In/Out <kbd>I</kbd><kbd>O</kbd> / 現在位置に挿入 <kbd>N</kbd> /
            Undo <kbd>Ctrl+Z</kbd> / Redo <kbd>Ctrl+Y</kbd> /
            検索 <kbd>Ctrl+F</kbd> / ヘルプ <kbd>?</kbd>
            <br />
            <span style={{ color: '#888' }}>
              <span style={{ color: '#5ab7ff' }}>■青</span>=再生中 /
              <span style={{ color: '#ffb347' }}>■橙</span>=選択中(I/O/Nなどの操作対象)。
              波形の <b>上部グレーバー</b>=シーク専用、<b>セグメント端ドラッグ</b>=開始/終了調整、<b>Ctrl+ホイール</b>=ズーム
            </span>
          </div>
        </div>
        <div className="right-pane">
          <SegmentList
            entries={entries}
            activeSegmentId={activeSegmentId}
            selectedSegmentId={selectedSegmentId}
            autoScrollEnabled={autoScrollEnabled}
            issuesByEntry={issuesByEntry}
            cpsThreshold={qcOptions.cpsThreshold}
            excludeSpeakerTagFromCps={qcOptions.excludeSpeakerTagFromCps}
            onPatch={handlePatch}
            onJumpTo={handleJumpTo}
            onActivate={setSelectedSegmentId}
            onInsertAfter={handleInsertAfter}
            onDelete={handleDelete}
            onMergeNext={handleMergeNext}
            onMove={handleMove}
            onDuplicate={handleDuplicate}
            onSplitAtCursor={handleSplitAtCursor}
            onSetIn={handleSetIn}
            onSetOut={handleSetOut}
          />
        </div>
        {showQcPanel && (
          <QcPanel
            issues={issues}
            onJumpTo={(id) => { handleJumpTo(id); }}
            onClose={() => setShowQcPanel(false)}
          />
        )}
      </div>

      <div className="footer-status">
        <span>{footerInfo}</span>
        <span className="footer-issues">
          {issuesCount.errors > 0 && <span className="err">エラー {issuesCount.errors}</span>}
          {issuesCount.warns > 0 && <span className="wn">警告 {issuesCount.warns}</span>}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          ? = ヘルプ
        </span>
      </div>

      {modalHelp && <HelpPanel onClose={() => setModalHelp(false)} />}
      {modalFind && (
        <FindReplaceDialog
          entries={entries}
          onReplaceAll={(pattern, flags, replacement) =>
            dispatch({ type: 'REPLACE_ALL', pattern, flags, replacement })
          }
          onNormalizeSpeakerTags={(style) => dispatch({ type: 'NORMALIZE_SPEAKER_TAGS', style })}
          onClose={() => setModalFind(false)}
        />
      )}
      {modalTimeshift && (
        <TimeshiftDialog
          hasActive={!!selectedSegmentId}
          onApplyAll={(deltaMs) => dispatch({ type: 'TIMESHIFT_ALL', deltaMs })}
          onApplyFromActive={(deltaMs) => {
            if (selectedSegmentId) dispatch({ type: 'TIMESHIFT_FROM', fromId: selectedSegmentId, deltaMs });
          }}
          onClose={() => setModalTimeshift(false)}
        />
      )}
      {modalSettings && (
        <SettingsDialog
          options={qcOptions}
          onChange={(patch) => setQcOptions((o) => ({ ...o, ...patch }))}
          onClose={() => setModalSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
