type Props = { onClose: () => void };

const SHORTCUTS: Array<{ keys: string; desc: string; when?: string }> = [
  { keys: 'Space', desc: '動画 再生 / 停止', when: 'テキスト欄外' },
  { keys: 'J / L', desc: '2秒戻す / 進める', when: 'テキスト欄外' },
  { keys: '[ / ]', desc: '前の / 次のセグメントへ移動', when: 'テキスト欄外' },
  { keys: 'I', desc: '選択中セグメントの 開始 を動画の現在時刻に設定' },
  { keys: 'O', desc: '選択中セグメントの 終了 を動画の現在時刻に設定' },
  { keys: 'Ctrl + Enter', desc: 'テキスト欄のカーソル位置でセグメント分割' },
  { keys: 'Ctrl + Z', desc: '元に戻す (Undo)' },
  { keys: 'Ctrl + Y / Ctrl + Shift + Z', desc: 'やり直す (Redo)' },
  { keys: 'Ctrl + F', desc: '検索 / 置換パネル' },
  { keys: 'N', desc: '現在の動画時刻に新規セグメント挿入', when: 'テキスト欄外' },
  { keys: '?', desc: 'このヘルプ表示', when: 'テキスト欄外' },
];

export function HelpPanel({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>ショートカット一覧</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="hint">
            キーボードで効率よく校正できるで〜。テキスト編集欄でも Ctrl + ○○ 系は効く。
          </p>
          <table className="shortcuts">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td><kbd>{s.keys}</kbd></td>
                  <td>{s.desc}</td>
                  <td className="when">{s.when ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 20 }}>マウス操作</h3>
          <ul className="ops">
            <li>行の <b>#ジャンプ</b> ボタン → その時刻へ動画シーク</li>
            <li>行と行の間の <b>+</b> → そこに新規セグメント挿入</li>
            <li>行の <b>分割</b> → テキスト欄のカーソル位置で2分割</li>
            <li>行の <b>結合▼</b> → 次の行と結合</li>
            <li>波形のオレンジ帯 → 字幕が無い発話っぽい区間(クリックで挿入)</li>
          </ul>

          <h3 style={{ marginTop: 20 }}>CPS(読み速度)の色分け</h3>
          <div className="cps-legend">
            <span style={{ color: '#5cd65c' }}>■ 緑</span> 読みやすい(60%以下) &nbsp;
            <span style={{ color: '#ffd93d' }}>■ 黄</span> 注意(60-80%) &nbsp;
            <span style={{ color: '#ffa940' }}>■ オレンジ</span> 警告(80-100%) &nbsp;
            <span style={{ color: '#ff4d4d' }}>■ 赤</span> 違反(超過)
          </div>
        </div>
      </div>
    </div>
  );
}
