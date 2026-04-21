import { useMemo, useState } from 'react';
import type { SrtEntry } from '../types';

type Props = {
  entries: SrtEntry[];
  onReplaceAll: (pattern: string, flags: string, replacement: string) => void;
  onNormalizeSpeakerTags: (style: 'fullwidth' | 'halfwidth') => void;
  onClose: () => void;
};

export function FindReplaceDialog({
  entries, onReplaceAll, onNormalizeSpeakerTags, onClose,
}: Props) {
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const flags = useMemo(() => `g${caseSensitive ? '' : 'i'}${useRegex ? '' : ''}`, [caseSensitive, useRegex]);
  const effectivePattern = useMemo(
    () => (useRegex ? pattern : escapeRegex(pattern)),
    [pattern, useRegex],
  );

  const preview = useMemo(() => {
    if (!pattern) return { matches: 0, samples: [] as Array<{ id: string; before: string; after: string }> };
    let regex: RegExp;
    try { regex = new RegExp(effectivePattern, flags); }
    catch { return { matches: 0, samples: [], error: true as const }; }
    let matches = 0;
    const samples: Array<{ id: string; before: string; after: string }> = [];
    for (const e of entries) {
      const found = e.text.match(regex);
      if (found && found.length > 0) {
        matches += found.length;
        if (samples.length < 10) {
          const after = e.text.replace(regex, replacement);
          if (after !== e.text) {
            samples.push({ id: e.id, before: e.text, after });
          }
        }
      }
    }
    return { matches, samples };
  }, [entries, effectivePattern, flags, replacement, pattern]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>検索 / 置換</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>検索</label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              autoFocus
              placeholder={useRegex ? '正規表現 (例: (.+)さん)' : 'そのまま検索'}
            />
          </div>
          <div className="field">
            <label>置換</label>
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={useRegex ? '$1 で後方参照可' : ''}
            />
          </div>
          <div className="toggles">
            <label>
              <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} />
              正規表現
            </label>
            <label>
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
              大文字小文字を区別
            </label>
          </div>

          <div className="preview">
            <div className="preview-head">
              プレビュー: {'error' in preview ? <span className="error">正規表現エラー</span> : `${preview.matches}件マッチ`}
            </div>
            {preview.samples.length > 0 && (
              <ul>
                {preview.samples.map((s) => (
                  <li key={s.id}>
                    <div className="before">- {s.before.replace(/\n/g, ' ⏎ ')}</div>
                    <div className="after">+ {s.after.replace(/\n/g, ' ⏎ ')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="btn-row">
            <button
              className="primary"
              disabled={!pattern || preview.matches === 0}
              onClick={() => { onReplaceAll(effectivePattern, flags, replacement); onClose(); }}
            >
              全置換
            </button>
            <button onClick={onClose}>キャンセル</button>
          </div>

          <hr />

          <div className="section-sub">
            <h3>日本語特化の一括整形</h3>
            <p className="hint-small">
              話者タグの形式を統一する。例: <code>(名前)</code> → <code>（名前）</code>
            </p>
            <div className="btn-row">
              <button onClick={() => { onNormalizeSpeakerTags('fullwidth'); onClose(); }}>
                話者タグを全角(（名前）)に統一
              </button>
              <button onClick={() => { onNormalizeSpeakerTags('halfwidth'); onClose(); }}>
                話者タグを半角((名前))に統一
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
