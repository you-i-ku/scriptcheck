import { useState } from 'react';

type Props = {
  onApplyAll: (deltaMs: number) => void;
  onApplyFromActive: (deltaMs: number) => void;
  hasActive: boolean;
  onClose: () => void;
};

export function TimeshiftDialog({ onApplyAll, onApplyFromActive, hasActive, onClose }: Props) {
  const [value, setValue] = useState('0');
  const delta = Number(value) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>タイムシフト(時刻の一括ズラし)</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="hint">
            全セグメントまたは選択中セグメント以降の開始/終了時刻を一括でズラす。
            正の数で前に進み、負の数で遅らせる。
          </p>
          <div className="field">
            <label>ズラす量 (ミリ秒)</label>
            <input
              type="number"
              step="100"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <span className="hint-small">
              {delta === 0 ? '' : `${delta > 0 ? '+' : ''}${(delta / 1000).toFixed(3)}秒`}
            </span>
          </div>
          <div className="btn-row">
            <button
              className="primary"
              disabled={delta === 0}
              onClick={() => { onApplyAll(delta); onClose(); }}
            >
              全体に適用
            </button>
            <button
              disabled={delta === 0 || !hasActive}
              onClick={() => { onApplyFromActive(delta); onClose(); }}
            >
              選択中以降に適用
            </button>
            <button onClick={onClose}>キャンセル</button>
          </div>
        </div>
      </div>
    </div>
  );
}
