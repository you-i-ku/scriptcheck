import { useMemo } from 'react';
import type { QcIssue } from '../lib/qc';

type Props = {
  issues: QcIssue[];
  onJumpTo: (entryId: string) => void;
  onClose: () => void;
};

const ICON: Record<string, string> = {
  cps: '速',
  duplicate: '重',
  gap: '間',
  minDuration: '短',
  kinsoku: '禁',
};

const LABEL: Record<string, string> = {
  cps: 'CPS超過',
  duplicate: '重複',
  gap: 'ギャップ不足',
  minDuration: '表示時間不足',
  kinsoku: '禁則',
};

export function QcPanel({ issues, onJumpTo, onClose }: Props) {
  const { errors, warns, byType } = useMemo(() => {
    const err = issues.filter((i) => i.severity === 'error');
    const wn = issues.filter((i) => i.severity === 'warn');
    const grouped: Record<string, QcIssue[]> = {};
    for (const i of issues) {
      (grouped[i.type] = grouped[i.type] ?? []).push(i);
    }
    return { errors: err, warns: wn, byType: grouped };
  }, [issues]);

  return (
    <div className="qc-panel">
      <div className="qc-head">
        <div>
          <b>品質チェック(QC)</b>
          <span className="qc-summary">
            エラー {errors.length} / 警告 {warns.length}
          </span>
        </div>
        <button onClick={onClose}>×</button>
      </div>
      <div className="qc-body">
        {issues.length === 0 ? (
          <div className="qc-empty">違反なし 🎉</div>
        ) : (
          Object.entries(byType).map(([type, list]) => (
            <div key={type} className="qc-section">
              <div className="qc-section-title">
                <span className="qc-icon">{ICON[type]}</span>
                {LABEL[type]} ({list.length})
              </div>
              <ul>
                {list.map((issue, i) => (
                  <li
                    key={`${issue.entryId}-${i}`}
                    className={`qc-issue qc-${issue.severity}`}
                    onClick={() => onJumpTo(issue.entryId)}
                  >
                    <span className="qc-message">{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
