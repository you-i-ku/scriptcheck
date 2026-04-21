import { useRef } from 'react';

type Props = {
  videoName: string | null;
  srtName: string | null;
  encoding: string | null;
  saveStatus: string;
  hasEntries: boolean;
  canUndo: boolean;
  canRedo: boolean;
  pdfBusy?: boolean;
  silenceBusy?: boolean;
  onLoadVideo: (file: File) => void;
  onLoadSrt: (file: File) => void;
  onExportSrt: () => void;
  onExportPdf: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenFind: () => void;
  onOpenTimeshift: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onToggleQcPanel: () => void;
  onDetectSilence: () => void;
  issuesCount: { errors: number; warns: number };
  hasSilenceResults: boolean;
  autoScrollEnabled: boolean;
  onToggleAutoScroll: () => void;
};

export function Toolbar(p: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const srtInput = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <div className="tb-group">
        <button onClick={() => videoInput.current?.click()}>動画</button>
        <span className="filename">{p.videoName ?? '(未選択)'}</span>
      </div>
      <div className="tb-group">
        <button onClick={() => srtInput.current?.click()}>SRT</button>
        <span className="filename">
          {p.srtName ? `${p.srtName} [${p.encoding}]` : '(未選択)'}
        </span>
      </div>

      <div className="tb-sep" />

      <div className="tb-group">
        <button onClick={p.onUndo} disabled={!p.canUndo} title="元に戻す (Ctrl+Z)">↶</button>
        <button onClick={p.onRedo} disabled={!p.canRedo} title="やり直す (Ctrl+Y)">↷</button>
      </div>

      <div className="tb-group">
        <button onClick={p.onOpenFind} disabled={!p.hasEntries} title="検索/置換 (Ctrl+F)">検索</button>
        <button onClick={p.onOpenTimeshift} disabled={!p.hasEntries} title="タイムシフト">⇄</button>
        <button onClick={p.onDetectSilence} disabled={!p.hasEntries || p.silenceBusy} title="字幕なし発話を検出">
          {p.silenceBusy ? '解析中…' : p.hasSilenceResults ? '再検出' : '無音検出'}
        </button>
        <button onClick={p.onToggleQcPanel} disabled={!p.hasEntries}>
          QC {p.issuesCount.errors > 0 && <span className="badge-err">{p.issuesCount.errors}</span>}
          {p.issuesCount.warns > 0 && <span className="badge-wn">{p.issuesCount.warns}</span>}
        </button>
        <button
          onClick={p.onToggleAutoScroll}
          title={p.autoScrollEnabled ? '再生で自動スクロール: ON' : '再生で自動スクロール: OFF'}
          className={p.autoScrollEnabled ? 'toggle-on' : 'toggle-off'}
        >
          {p.autoScrollEnabled ? '自動追従◉' : '自動追従○'}
        </button>
      </div>

      <div className="spacer" />
      <span className="status">{p.saveStatus}</span>

      <div className="tb-group">
        <button onClick={p.onOpenSettings} title="QC設定">⚙</button>
        <button onClick={p.onOpenHelp} title="ヘルプ (?)">?</button>
      </div>

      <div className="tb-sep" />

      <div className="tb-group">
        <button onClick={p.onExportSrt} disabled={!p.hasEntries}>SRT出力</button>
        <button className="primary" onClick={p.onExportPdf} disabled={!p.hasEntries || p.pdfBusy}>
          {p.pdfBusy ? 'PDF生成中…' : 'PDF化'}
        </button>
      </div>

      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onLoadVideo(f); e.target.value = ''; }}
      />
      <input
        ref={srtInput}
        type="file"
        accept=".srt,text/plain"
        className="hidden-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onLoadSrt(f); e.target.value = ''; }}
      />
    </div>
  );
}
