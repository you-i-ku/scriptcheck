#!/usr/bin/env python3
"""
SRT字幕ファイル → 台本PDF変換スクリプト

使い方:
    python convert_srt_to_pdf.py

    input/   SRTファイルを配置
    output/  PDFが出力される（ファイル名は日付_元ファイル名.pdf）
"""

import os
import re
import sys
import math
from datetime import datetime

try:
    import fitz  # PyMuPDF
except ImportError:
    print("エラー: PyMuPDF が必要です。 pip install PyMuPDF")
    sys.exit(1)

try:
    import budoux
    _budoux_parser = budoux.load_default_japanese_parser()
except ImportError:
    print("エラー: budoux が必要です。 pip install budoux")
    sys.exit(1)

# ================================================================
# レイアウト定数（pdfplumber数値解析による精密計測値）
# ================================================================

PAGE_W = 515.9
PAGE_H = 728.5

# セクション Y 座標（水平罫線の中心）
Y_TOP      = 71.1
Y_NUM_BTM  = 113.6
Y_TIME_BTM = 248.6
Y_CHAR_BTM = 362.0
Y_DLG_BTM  = 638.3

# X 座標
X_LEFT       = 79.0
X_RIGHT      = 472.4    # ページ2以降の右端
X_RIGHT_P1   = 478.2    # ページ1の右端（ラベル列込み）
LABEL_COL_W  = 24.0
X_LABEL      = X_RIGHT_P1 - LABEL_COL_W

# フォント
FONT_SIZE    = 13.0
FONT_SIZE_PG = 10.6
CHAR_SP      = 13.0     # 縦書き文字間隔
LINE_W       = 15.0     # 縦1行の幅

# ① タイムコード（横書きrotate=270）
TIME_Y       = 119.6
TIME_FONT    = 9.0

# 人物名・セリフ
CHAR_Y  = 265.9
DLG_Y   = 379.4
DLG_END = Y_DLG_BTM - 8
CHARS_PER_COL  = int((DLG_END - DLG_Y) / CHAR_SP)
CHARS_PER_NAME = int((Y_CHAR_BTM - 4 - CHAR_Y) / CHAR_SP)  # 人物欄の最大文字数（≈7）

# 罫線（フォーマットPDF実測: 厚さ0.48pt）
LINE_HW = 0.24

# 最小列幅
MIN_COL_W = 38.0

# ページ番号
PG_NUM_Y = 656.3

# ② 縦書きで 90° 回転する文字（括弧類追加）
ROTATE_CHARS = set('ー〜～…—─＝ｰ（）()「」『』【】')

# ④ 小かな（縦書きで右寄せ）
SMALL_KANA = set('っゃゅょぁぃぅぇぉッャュョァィゥェォ')

# ④ 句読点（縦書きで右上寄せ）
PUNCTUATION_TR = set('、。，．')

# グローバルフォント設定
_font_file = None
_font_name = "jp"
_font_obj  = None


# ================================================================
# フォント
# ================================================================

def find_font():
    for p in [
        r"C:\Windows\Fonts\yumin.ttf",
        r"C:\Windows\Fonts\msmincho.ttc",
        r"C:\Windows\Fonts\BIZ-UDMinchoM.ttc",
        r"C:\Windows\Fonts\msgothic.ttc",
        r"C:\Windows\Fonts\meiryo.ttc",
    ]:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("日本語フォントが見つかりません")


def init_font(path):
    global _font_file, _font_obj
    _font_file = path
    _font_obj = fitz.Font(fontfile=path)


def text_width(text, size=FONT_SIZE):
    return _font_obj.text_length(text, fontsize=size)


# ================================================================
# SRT パーサー（③ 人物別セリフ保持）
# ================================================================

def parse_srt(path):
    for enc in ['utf-8-sig', 'utf-8', 'cp932', 'shift_jis']:
        try:
            with open(path, 'r', encoding=enc) as f:
                content = f.read()
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"読み込めません: {path}")

    entries = []
    for block in re.split(r'\n\n+', content.strip()):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue

        try:
            seq = int(lines[0].strip())
        except ValueError:
            continue

        m = re.match(
            r'(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})',
            lines[1],
        )
        if not m:
            continue

        start = m.group(1).replace('.', ',')
        end   = m.group(2).replace('.', ',')

        # ③ 人物ごとにセリフを分離保持
        char_dialogues = []  # [(name, dialogue), ...]

        for line in lines[2:]:
            line = line.strip()
            if not line:
                continue
            cm = re.match(r'（(.+?)）\s*(.*)', line)
            if not cm:
                cm = re.match(r'\(([^)]+)\)\s*(.*)', line)
            if cm:
                char_dialogues.append((cm.group(1), cm.group(2).strip()))
            else:
                if char_dialogues:
                    prev_name, prev_dlg = char_dialogues[-1]
                    char_dialogues[-1] = (prev_name,
                                          (prev_dlg + ' ' + line).strip())
                else:
                    char_dialogues.append(('', line))

        # 特殊文字置換
        cleaned = []
        for name, dlg in char_dialogues:
            dlg = re.sub(r'<[^>]+>', '', dlg).strip()
            dlg = dlg.replace('\u2E3A', '——')
            dlg = dlg.replace('\u2E3B', '———')
            dlg = dlg.replace('\u2014', '—')
            cleaned.append((name, dlg))

        entries.append({
            'seq': seq,
            'start': start,
            'end': end,
            'char_dialogues': cleaned,
        })

    return entries


# ================================================================
# レイアウト計算
# ================================================================

def effective_len(text):
    """スペースを半分としてカウントした実効文字数"""
    return sum(0.5 if c in ' \u3000' else 1 for c in text)


def calc_col_width(entry):
    """③ 各人物のセリフ行数・人物名行数を考慮して列幅を計算"""
    char_dlgs = entry['char_dialogues']
    if not char_dlgs:
        return MIN_COL_W

    total_lines = 0
    for name, dlg in char_dlgs:
        name_lines = len(smart_split(name, CHARS_PER_NAME)) if name else 0
        dlg_lines = len(smart_split(dlg, CHARS_PER_COL)) if dlg else 0
        total_lines += max(name_lines, dlg_lines, 1)

    needed = total_lines * LINE_W
    return max(MIN_COL_W, needed)


def pack_pages(entries):
    pages = []
    idx = 0
    pg = 0

    while idx < len(entries):
        pg += 1
        is_first = (pg == 1)
        avail = (X_LABEL - X_LEFT) if is_first else (X_RIGHT - X_LEFT)

        pg_entries = []
        pg_widths  = []
        total = 0.0

        while idx < len(entries):
            w = calc_col_width(entries[idx])
            if total + w > avail and pg_entries:
                break
            pg_entries.append(entries[idx])
            pg_widths.append(w)
            total += w
            idx += 1

        if pg_entries and total < avail:
            extra = (avail - total) / len(pg_entries)
            pg_widths = [w + extra for w in pg_widths]

        pages.append((pg_entries, pg_widths))

    return pages


# ================================================================
# ④ 縦書き描画（文字中央揃え・括弧回転・句読点位置補正）
# ================================================================

def vtext(page, x_center, y, text, fontsize=FONT_SIZE, char_sp=CHAR_SP):
    """縦書きテキスト（各文字を中心軸に配置）"""
    cy = y
    for ch in text:
        if ch in ' \u3000':
            cy += char_sp * 0.5
            continue

        cw = text_width(ch, fontsize)

        if ch in ROTATE_CHARS:
            # ② 括弧・長音等を90°回転
            draw_x = x_center - cw / 2
            pivot_x = x_center
            pivot_y = cy - fontsize * 0.3
            page.insert_text(
                fitz.Point(draw_x, cy), ch,
                fontname=_font_name, fontfile=_font_file,
                fontsize=fontsize,
                morph=(fitz.Point(pivot_x, pivot_y), fitz.Matrix(-90)),
            )
        elif ch in SMALL_KANA:
            # 小かな: やや右寄せ
            draw_x = x_center - cw / 2 + fontsize * 0.12
            page.insert_text(
                fitz.Point(draw_x, cy - fontsize * 0.08), ch,
                fontname=_font_name, fontfile=_font_file,
                fontsize=fontsize,
            )
        elif ch in PUNCTUATION_TR:
            # 句読点: 右上寄せ
            draw_x = x_center + fontsize * 0.1
            page.insert_text(
                fitz.Point(draw_x, cy - fontsize * 0.5), ch,
                fontname=_font_name, fontfile=_font_file,
                fontsize=fontsize,
            )
        else:
            # 通常文字: 中央揃え
            draw_x = x_center - cw / 2
            page.insert_text(
                fitz.Point(draw_x, cy), ch,
                fontname=_font_name, fontfile=_font_file,
                fontsize=fontsize,
            )
        cy += char_sp
    return cy


# ================================================================
# セリフ描画（複数縦行対応）
# ================================================================

def smart_split(text, max_chars):
    """budouxで自然な日本語分割点を使って折り返し"""
    if not text or effective_len(text) <= max_chars:
        return [text] if text else []

    chunks = _budoux_parser.parse(text)
    lines = []
    current = ""
    current_len = 0.0

    for chunk in chunks:
        chunk_len = effective_len(chunk)
        if chunk_len > max_chars:
            # チャンクが1行に収まらない→文字単位フォールバック
            for ch in chunk:
                ch_len = 0.5 if ch in ' \u3000' else 1.0
                if current_len + ch_len > max_chars and current:
                    lines.append(current)
                    current = ""
                    current_len = 0.0
                current += ch
                current_len += ch_len
        elif current_len + chunk_len > max_chars and current:
            lines.append(current)
            current = chunk
            current_len = chunk_len
        else:
            current += chunk
            current_len += chunk_len

    if current:
        lines.append(current)

    return lines


def draw_dialogue(page, col_right, col_left, text):
    """セリフを縦書き配置（右→左に複数行）"""
    vlines = smart_split(text, CHARS_PER_COL)
    x_center = col_right - LINE_W / 2
    for vl in vlines:
        if x_center - LINE_W / 2 < col_left:
            break
        vtext(page, x_center, DLG_Y, vl)
        x_center -= LINE_W


def draw_name(page, col_right, col_left, name):
    """人物名を縦書き配置（長い名前は折り返し）"""
    name_lines = smart_split(name, CHARS_PER_NAME)
    x_center = col_right - LINE_W / 2
    for nl in name_lines:
        if x_center - LINE_W / 2 < col_left:
            break
        vtext(page, x_center, CHAR_Y, nl)
        x_center -= LINE_W


# ================================================================
# グリッド描画（フォーマットPDF完全再現）
# ================================================================

def draw_grid(page, col_rights, col_lefts, right_edge, is_first):
    v_xs = set()
    for cr in col_rights:
        v_xs.add(cr)
    for cl in col_lefts:
        v_xs.add(cl)
    if is_first:
        v_xs.add(X_LABEL)
        v_xs.add(X_RIGHT_P1)

    h_left = min(v_xs)
    h_right = max(v_xs)

    for y in [Y_TOP, Y_NUM_BTM, Y_TIME_BTM, Y_CHAR_BTM, Y_DLG_BTM]:
        page.draw_rect(
            fitz.Rect(h_left - LINE_HW, y - LINE_HW,
                       h_right + LINE_HW, y + LINE_HW),
            fill=(0, 0, 0), width=0,
        )

    sections = [
        (Y_TOP,      Y_NUM_BTM),
        (Y_NUM_BTM,  Y_TIME_BTM),
        (Y_TIME_BTM, Y_CHAR_BTM),
        (Y_CHAR_BTM, Y_DLG_BTM),
    ]
    for x in v_xs:
        for y1, y2 in sections:
            page.draw_rect(
                fitz.Rect(x - LINE_HW, y1 + LINE_HW,
                           x + LINE_HW, y2 - LINE_HW),
                fill=(0, 0, 0), width=0,
            )


# ================================================================
# ページ描画
# ================================================================

def draw_page(doc, page_data, page_num, is_first):
    entries, widths = page_data
    page = doc.new_page(width=PAGE_W, height=PAGE_H)

    right_edge = X_RIGHT_P1 if is_first else X_RIGHT
    data_right = X_LABEL if is_first else X_RIGHT

    col_rights = []
    x = data_right
    for w in widths:
        col_rights.append(x)
        x -= w
    col_lefts = [col_rights[i] - widths[i] for i in range(len(widths))]

    draw_grid(page, col_rights, col_lefts, right_edge, is_first)

    # ラベル（1頁目のみ）
    if is_first:
        lx = X_LABEL + LABEL_COL_W / 2
        vtext(page, lx, 131.3, "タイム")
        vtext(page, lx, 266.2, "人物")
        vtext(page, lx, 379.7, "セリフ")

    for i, entry in enumerate(entries):
        cr = col_rights[i]
        cl = col_lefts[i]
        cw = widths[i]
        cx = (cr + cl) / 2

        # --- カット番号（横書き・中央） ---
        ns = str(entry['seq'])
        tw = text_width(ns, FONT_SIZE)
        page.insert_text(
            fitz.Point(cx - tw / 2, Y_TOP + (Y_NUM_BTM - Y_TOP) * 0.7),
            ns,
            fontname=_font_name, fontfile=_font_file,
            fontsize=FONT_SIZE,
        )

        # --- ① タイムコード（横書き→右90°回転 = rotate=270） ---
        time_fs = min(TIME_FONT, (cw - 4) / 2)
        time_fs = max(5.0, time_fs)

        # 開始時刻（列の右寄り）
        start_x = cx + time_fs * 0.7
        page.insert_text(
            fitz.Point(start_x, TIME_Y), entry['start'],
            fontname=_font_name, fontfile=_font_file,
            fontsize=time_fs, rotate=270,
        )

        # "-->" 矢印（開始時刻の下）
        start_len = text_width(entry['start'], time_fs)
        arrow_y = TIME_Y + start_len + 3
        if arrow_y + text_width("-->", time_fs) < Y_TIME_BTM - 2:
            page.insert_text(
                fitz.Point(start_x, arrow_y), "-->",
                fontname=_font_name, fontfile=_font_file,
                fontsize=time_fs, rotate=270,
            )

        # 終了時刻（列の左寄り）
        end_x = cx - time_fs * 0.7
        page.insert_text(
            fitz.Point(end_x, TIME_Y), entry['end'],
            fontname=_font_name, fontfile=_font_file,
            fontsize=time_fs, rotate=270,
        )

        # --- ③ 人物名・セリフ（人物別並列配置） ---
        char_dlgs = entry['char_dialogues']
        n_speakers = len(char_dlgs)

        if n_speakers == 0:
            continue

        if n_speakers == 1:
            name, dlg = char_dlgs[0]
            if name:
                draw_name(page, cr, cl, name)
            if dlg:
                draw_dialogue(page, cr, cl, dlg)
        else:
            # 複数人物: 列幅を均等分割し人物名とセリフを対応配置
            sub_w = cw / n_speakers
            for j, (name, dlg) in enumerate(char_dlgs):
                sub_right = cr - j * sub_w
                sub_left = sub_right - sub_w

                if name:
                    draw_name(page, sub_right, sub_left, name)
                if dlg:
                    draw_dialogue(page, sub_right, sub_left, dlg)

    # --- ページ番号 ---
    pn = str(page_num)
    pw = text_width(pn, FONT_SIZE_PG)
    page.insert_text(
        fitz.Point(PAGE_W / 2 - pw / 2, PG_NUM_Y + FONT_SIZE_PG),
        pn,
        fontname=_font_name, fontfile=_font_file,
        fontsize=FONT_SIZE_PG,
    )


# ================================================================
# メイン
# ================================================================

def main():
    base = os.path.dirname(os.path.abspath(__file__))
    input_dir  = os.path.join(base, 'input')
    output_dir = os.path.join(base, 'output')
    os.makedirs(output_dir, exist_ok=True)

    font_path = find_font()
    init_font(font_path)
    print(f"フォント: {font_path}")

    if not os.path.isdir(input_dir):
        print(f"エラー: {input_dir} が見つかりません")
        sys.exit(1)

    srt_files = [f for f in os.listdir(input_dir) if f.lower().endswith('.srt')]
    if not srt_files:
        print("エラー: input/ にSRTファイルがありません")
        sys.exit(1)

    for srt_name in srt_files:
        srt_path = os.path.join(input_dir, srt_name)
        print(f"\n処理中: {srt_name}")

        entries = parse_srt(srt_path)
        print(f"  {len(entries)} エントリ検出")
        if not entries:
            print("  スキップ")
            continue

        pages = pack_pages(entries)
        print(f"  {len(pages)} ページ生成")

        doc = fitz.open()
        for pi, pd in enumerate(pages):
            draw_page(doc, pd, pi + 1, is_first=(pi == 0))

        today = datetime.now().strftime('%Y%m%d')
        stem = os.path.splitext(srt_name)[0]
        out_name = f"{today}_{stem}.pdf"
        out_path = os.path.join(output_dir, out_name)
        doc.save(out_path)
        doc.close()
        print(f"  出力: {out_name}")

    print("\n完了！")


if __name__ == '__main__':
    main()
