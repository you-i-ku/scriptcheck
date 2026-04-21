import type { QcOptions } from '../lib/qc';

type Props = {
  options: QcOptions;
  onChange: (patch: Partial<QcOptions>) => void;
  onClose: () => void;
};

export function SettingsDialog({ options, onChange, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>QC(品質チェック)設定</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>CPS閾値 (読み速度上限)</label>
            <input
              type="number"
              min="1"
              max="40"
              step="1"
              value={options.cpsThreshold}
              onChange={(e) => onChange({ cpsThreshold: Number(e.target.value) || 17 })}
            />
            <span className="hint-small">
              Netflix日本語: 成人17 / 子供13 / 伝統的な基準は4。デフォルト17
            </span>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={options.excludeSpeakerTagFromCps}
                onChange={(e) => onChange({ excludeSpeakerTagFromCps: e.target.checked })}
              />
              CPS計算で話者タグ(（名前）)を除外
            </label>
            <span className="hint-small">ON(推奨): 実際の読み速度に近い / OFF: 画面表示文字ベース</span>
          </div>
          <div className="field">
            <label>最短表示時間 (ミリ秒)</label>
            <input
              type="number"
              min="100"
              max="3000"
              step="100"
              value={options.minDurationMs}
              onChange={(e) => onChange({ minDurationMs: Number(e.target.value) || 700 })}
            />
            <span className="hint-small">これ未満なら「表示時間不足」警告</span>
          </div>
          <div className="field">
            <label>最小ギャップ (ミリ秒)</label>
            <input
              type="number"
              min="0"
              max="500"
              step="20"
              value={options.minGapMs}
              onChange={(e) => onChange({ minGapMs: Number(e.target.value) || 84 })}
            />
            <span className="hint-small">前後の字幕間隔。2フレーム=84ms(24fps)が目安</span>
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={options.checkKinsoku}
                onChange={(e) => onChange({ checkKinsoku: e.target.checked })}
              />
              行頭禁則チェック (「を」「は」「が」等)
            </label>
          </div>
          <div className="btn-row">
            <button onClick={onClose}>閉じる</button>
          </div>
        </div>
      </div>
    </div>
  );
}
