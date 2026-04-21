# scriptcheck

SRT字幕ファイル → 縦書き台本PDFへの変換ツール、および動画と連動したSRT校正エディタ。

## 構成

| ディレクトリ / ファイル | 役割 |
|---|---|
| `convert_srt_to_pdf.py` | SRT → 縦書き台本PDF 変換CLI(Python + PyMuPDF + budoux) |
| `run.bat` | CLI実行用バッチ(`venv` 前提) |
| `input/` | 変換対象のSRTファイル置き場 |
| `output/` | 生成されたPDFの出力先 |
| `pdf-format/` | レイアウト参考用のサンプルPDF |
| `srt-editor/` | 動画連動のSRT校正WebアプリUI(Vite + React + TypeScript)。PDF化機能も統合済み |

## 使い方

### A. CLIで一括PDF化(従来フロー)

```bash
# 初回のみ
python -m venv venv
venv\Scripts\pip install -r requirements.txt

# 実行: input/ のSRTを output/ にPDF化
run.bat
```

### B. Webエディタで校正+PDF化

`srt-editor/README.md` 参照。動画とSRTをブラウザに読み込み、校正 → PDF化までワンストップ。
