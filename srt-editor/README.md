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

## キーボードショートカット

- `Space`: 再生/停止
