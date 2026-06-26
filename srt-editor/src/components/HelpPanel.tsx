import { useState } from 'react';

type Props = { onClose: () => void };

const SHORTCUTS: Array<{ keys: string; desc: string; when?: string }> = [
  { keys: 'Space', desc: '動画 再生 / 停止', when: 'テキスト欄外' },
  { keys: 'J / L', desc: '2秒戻す / 進める', when: 'テキスト欄外' },
  { keys: '[ / ]', desc: '前の / 次のセグメントへ移動', when: 'テキスト欄外' },
  { keys: 'I', desc: '選択中セグメントの 開始 を動画の現在時刻に設定' },
  { keys: 'O', desc: '選択中セグメントの 終了 を動画の現在時刻に設定' },
  { keys: 'Ctrl + Enter', desc: 'テキスト欄のカーソル位置でセグメント分割' },
  { keys: 'Alt + Enter / 改行ボタン', desc: 'セリフ内部に改行を挿入' },
  { keys: 'Ctrl + Z', desc: '元に戻す (Undo)' },
  { keys: 'Ctrl + Y / Ctrl + Shift + Z', desc: 'やり直す (Redo)' },
  { keys: 'Ctrl + F', desc: '検索 / 置換パネル' },
  { keys: 'N', desc: '現在の動画時刻に新規セグメント挿入', when: 'テキスト欄外' },
  { keys: '?', desc: 'このヘルプ表示', when: 'テキスト欄外' },
];

function answerManualBot(q: string): string {
  const s = q.trim().toLowerCase();
  if (!s) return '知りたい操作を入力してください。例: 複製、改行、書き出し、CPS、無音解析';
  if (s.includes('複製') || s.includes('duplicate')) {
    return 'セグメント行の「複製」を押すと、その行のセリフを次の位置にコピーします。UndoはCtrl+Zです。';
  }
  if (s.includes('順番') || s.includes('入れ替') || s.includes('移動')) {
    return 'セグメント行の「↑」「↓」で上下に移動できます。時間は自動再計算せず、字幕の並びだけを入れ替えます。';
  }
  if (s.includes('改行') || s.includes('line')) {
    return 'セリフ欄にカーソルを置いて「改行」ボタン、またはAlt+Enterで内部改行を入れられます。Ctrl+Enterはセグメント分割です。';
  }
  if (s.includes('分割') || s.includes('split')) {
    return 'セリフ欄の分けたい位置にカーソルを置き、Ctrl+Enterでセグメントを2つに分割します。分割時刻は再生位置が範囲内なら再生位置、そうでなければ中央です。';
  }
  if (s.includes('結合') || s.includes('merge')) {
    return '行の「結合」を押すと、選んだセグメントと次のセグメントを1つにまとめます。';
  }
  if (s.includes('書き出') || s.includes('export') || s.includes('保存')) {
    return '上部ツールバーのSRT書き出しで字幕ファイルを保存できます。PDF書き出しも同じツールバーから実行できます。';
  }
  if (s.includes('cps') || s.includes('読み')) {
    return 'CPSは読み速度です。緑は余裕、黄/オレンジは注意、赤は速すぎる可能性があります。設定からしきい値を変更できます。';
  }
  if (s.includes('無音') || s.includes('発話')) {
    return '動画とSRTを読み込んだあと、無音解析を実行すると字幕が無い発話らしい区間を波形上に表示します。';
  }
  return '近い項目が見つかりませんでした。「複製」「改行」「分割」「結合」「書き出し」「CPS」「無音解析」などの語で聞いてください。';
}

export function HelpPanel({ onClose }: Props) {
  const [botQuestion, setBotQuestion] = useState('');
  const [botAnswer, setBotAnswer] = useState(answerManualBot(''));

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
            <li>行の <b>↑ / ↓</b> → セグメント順を入れ替え</li>
            <li>行の <b>複製</b> → 同じセリフを次の位置に複製</li>
            <li>行の <b>結合</b> → 次の行と結合</li>
            <li>波形のオレンジ帯 → 字幕が無い発話っぽい区間(クリックで挿入)</li>
          </ul>

          <h3 style={{ marginTop: 20 }}>CPS(読み速度)の色分け</h3>
          <div className="cps-legend">
            <span style={{ color: '#5cd65c' }}>■ 緑</span> 読みやすい(60%以下) &nbsp;
            <span style={{ color: '#ffd93d' }}>■ 黄</span> 注意(60-80%) &nbsp;
            <span style={{ color: '#ffa940' }}>■ オレンジ</span> 警告(80-100%) &nbsp;
            <span style={{ color: '#ff4d4d' }}>■ 赤</span> 違反(超過)
          </div>

          <h3 style={{ marginTop: 20 }}>説明書bot</h3>
          <div className="manual-bot">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setBotAnswer(answerManualBot(botQuestion));
              }}
            >
              <input
                value={botQuestion}
                onChange={(e) => setBotQuestion(e.target.value)}
                placeholder="例: セリフ内で改行したい"
              />
              <button className="primary" type="submit">聞く</button>
            </form>
            <div className="manual-bot-answer">{botAnswer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
