# srt-editor

動画プレイヤー・波形と連動するSRT校正エディタ。ブラウザ完結、サーバー処理ゼロ。

## 機能

- 動画 + SRT をローカル読み込み(アップロードなし、機密性◎)
- セグメントリスト上でテキスト編集・タイミング調整
- WaveSurfer.js による波形表示、クリックでシーク
- 元ファイルのエンコーディング(utf-8-sig / utf-8 / cp932 / shift_jis)を保持してSRTダウンロード
- **PDF化**: 親リポの `convert_srt_to_pdf.py` のレイアウトをJS移植、ブラウザ内で縦書き台本PDF生成
- IndexedDB 自動保存 + セッション復帰

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に出力
```

## 説明書bot (Gemini)

Vercel では `GEMINI_API_KEY` を Environment Variables に設定すると、ヘルプ内の説明書botが `docs/user-guide.md` を参照して回答します。

- `GEMINI_API_KEY`: 必須。サーバレス関数だけが読む。`VITE_` prefix は付けない。
- `GEMINI_MODEL`: 任意。未設定時は `gemini-2.5-flash`。

Gemini APIが未設定またはエラーの場合は、アプリ内のローカルFAQにフォールバックします。

## 技術スタック

| 領域 | 採用 |
|---|---|
| ビルド | Vite + React 19 + TypeScript |
| PDF | pdf-lib + @pdf-lib/fontkit |
| 日本語分割 | budoux |
| 波形 | wavesurfer.js v7 (Regionsプラグイン) |
| エンコーディング | encoding-japanese (cp932/shift_jis) |
| 永続化 | idb (IndexedDB wrapper) |
| フォント | Noto Serif JP (SIL OFL, `public/fonts/`) |

## キーボードショートカット (Aegisub準拠)

| キー | 動作 |
|---|---|
| `Space` | 動画再生/停止 |
| `J` / `L` | 2秒戻す / 進める |
| `[` / `]` | 前 / 次セグメントへ |
| `I` / `O` | 現在時刻を選択中セグメントの 開始 / 終了 に設定 |
| `N` | 現在時刻に新規セグメント挿入 |
| `Ctrl+Enter` | テキスト欄のカーソル位置でセグメント分割 |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+F` | 検索 / 置換 |
| `?` | ヘルプパネル |

## QC(品質チェック)機能

行ごとにCPS(読み速度)を色分け表示。以下の違反をリアルタイム検出:

- CPS超過(デフォルト17、カスタマイズ可)
- セグメント重複・ギャップ不足(Netflix基準: 2フレーム=84ms)
- 最短表示時間不足
- 行頭禁則(「を」「は」「が」等)

## その他の機能

- **無音区間検出**: 音声解析して字幕に載っていない発話区間を波形上にハイライト
- **タイムシフト**: 全体 or 選択中以降のタイムコードを一括ズラし
- **話者タグ正規化**: `(名前)` / `（名前）` を一括統一
