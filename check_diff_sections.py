import pdfplumber
import re
import sys

def extract_sections(path):
    sections = {}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            # ページ内の単語を座標付きで取得
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            
            # セクション番号、人物名、セリフの領域を定義（convert_srt_to_pdf.pyの定数に近い値を使用）
            # Y座標範囲: 
            #   番号: 71.1 - 113.6
            #   人物: 248.6 - 362.0
            #   セリフ: 362.0 - 638.3
            
            current_page_sections = []
            
            # 1. まずセクション番号（カット番号）を見つける
            num_words = [w for w in words if 70 <= w['top'] <= 120]
            # X座標の降順（右から左）にソート
            num_words.sort(key=lambda x: x['x0'], reverse=True)
            
            for nw in num_words:
                text = nw['text'].strip()
                if text.isdigit():
                    sec_num = int(text)
                    # そのセクション番号のX座標範囲を特定（少し余裕を持たせる）
                    x0, x1 = nw['x0'] - 15, nw['x1'] + 15
                    
                    # 2. そのX範囲内にある人物名とセリフを抽出
                    # 人物名エリア
                    char_words = [w for w in words if 240 <= w['top'] <= 370 and x0 <= w['x0'] <= x1]
                    char_words.sort(key=lambda x: x['top']) # 縦書きなので上から下
                    char_text = "".join([w['text'] for w in char_words])
                    
                    # セリフエリア
                    dlg_words = [w for w in words if 370 <= w['top'] <= 650 and x0 <= w['x0'] <= x1]
                    dlg_words.sort(key=lambda x: x['top']) # 縦書きなので上から下
                    dlg_text = "".join([w['text'] for w in dlg_words])
                    
                    sections[sec_num] = {
                        'char': char_text,
                        'dlg': dlg_text
                    }
    return sections

def normalize(text):
    # 比較のために記号や空白を正規化
    if not text: return ""
    # CIDコードなどの特殊表記や、揺れやすい記号を統一
    text = re.sub(r'\(cid:\d+\)', '■', text) # CID文字は一旦伏せ字にして比較対象とする
    text = text.replace('　', '').replace(' ', '').replace('\n', '')
    text = text.replace('―', '—').replace('～', '〜')
    return text

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ref_path = 'pdf-format/20260321_恋は雨上がりのように_S01E06_「沙雨（さう）」.pdf'
    out_path = 'output/20260327_恋は雨上がりのように_S01E06_沙雨 (さう).ja.closedcaptions.pdf'

    print("解析中...")
    ref_secs = extract_sections(ref_path)
    out_secs = extract_sections(out_path)

    all_nums = sorted(list(set(ref_secs.keys()) | set(out_secs.keys())))
    
    diff_sections = []

    for num in all_nums:
        r = ref_secs.get(num, {'char': '[欠落]', 'dlg': '[欠落]'})
        o = out_secs.get(num, {'char': '[欠落]', 'dlg': '[欠落]'})
        
        r_char = normalize(r['char'])
        o_char = normalize(o['char'])
        r_dlg = normalize(r['dlg'])
        o_dlg = normalize(o['dlg'])

        if r_char != o_char or r_dlg != o_dlg:
            diff_sections.append(num)
            print(f"セクション {num}: 相違あり")
            if r_char != o_char:
                print(f"  人物名: 原本[{r['char']}] vs 出力[{o['char']}]")
            if r_dlg != o_dlg:
                print(f"  セリフ: 原本[{r['dlg']}] vs 出力[{o['dlg']}]")
            print("-" * 30)

    if not diff_sections:
        print("\nすべてのセクションが一致しました。")
    else:
        print(f"\n合計 {len(diff_sections)} 個のセクションに違いがありました。")
        print(f"相違のある番号: {diff_sections}")

if __name__ == "__main__":
    main()
