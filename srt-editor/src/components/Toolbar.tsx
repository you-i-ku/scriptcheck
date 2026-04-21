import { useRef } from 'react';

type Props = {
  videoName: string | null;
  srtName: string | null;
  encoding: string | null;
  saveStatus: string;
  hasEntries: boolean;
  onLoadVideo: (file: File) => void;
  onLoadSrt: (file: File) => void;
  onExportSrt: () => void;
  onExportPdf: () => void;
  pdfBusy?: boolean;
};

export function Toolbar({
  videoName, srtName, encoding, saveStatus, hasEntries,
  onLoadVideo, onLoadSrt, onExportSrt, onExportPdf, pdfBusy,
}: Props) {
  const videoInput = useRef<HTMLInputElement>(null);
  const srtInput = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <button onClick={() => videoInput.current?.click()}>動画を開く</button>
      <span className="filename">{videoName ?? '(未選択)'}</span>

      <button onClick={() => srtInput.current?.click()}>SRTを開く</button>
      <span className="filename">
        {srtName ? `${srtName} [${encoding}]` : '(未選択)'}
      </span>

      <div className="spacer" />
      <span className="status">{saveStatus}</span>

      <button onClick={onExportSrt} disabled={!hasEntries}>SRT出力</button>
      <button className="primary" onClick={onExportPdf} disabled={!hasEntries || pdfBusy}>
        {pdfBusy ? 'PDF生成中…' : 'PDF化'}
      </button>

      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onLoadVideo(f);
          e.target.value = '';
        }}
      />
      <input
        ref={srtInput}
        type="file"
        accept=".srt,text/plain"
        className="hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onLoadSrt(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
