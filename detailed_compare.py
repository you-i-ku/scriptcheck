import pdfplumber
import sys

def get_text_from_pdf(path):
    text_data = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            # ページごとにテキストを抽出。座標順にソートされる傾向がある。
            content = page.extract_text()
            if content:
                # 文字化け対策としてUnicode正規化などが必要な場合があるが、まずはそのまま
                text_data.append(content)
    return "\n".join(text_data)

def normalize_line(line):
    # 改行や不必要な空白を削除し、比較を容易にする。
    return line.replace('\n', '').replace(' ', '').replace('　', '').strip()

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ref_path = 'pdf-format/20260321_恋は雨上がりのように_S01E06_「沙雨（さう）」.pdf'
    out_path = 'output/20260327_恋は雨上がりのように_S01E06_沙雨 (さう).ja.closedcaptions.pdf'

    print(f"比較中...\n原本: {ref_path}\n出力: {out_path}\n")

    try:
        ref_text = get_text_from_pdf(ref_path)
        out_text = get_text_from_pdf(out_path)
        
        # セリフと思われる部分を抽出しやすくするため、
        # ある程度まとまった単位で比較できるように整理を試みる。
        # 縦書きPDFの場合、一文字ずつ抽出されることもあるため、
        # 本来は座標ベースで結合する必要があるが、まずは全体一致を確認。

        # 差分があるか簡易比較
        if normalize_line(ref_text) == normalize_line(out_text):
            print("【結果】セリフおよび全体の内容に、一言一句の違いはありません。")
        else:
            print("【結果】内容に差異が見つかりました。詳細を調査します。\n")
            # より詳細な比較（ページ単位、またはセクション単位など）
            # ここではまず抽出したテキストの先頭部分を表示して内容を確認。
            print("--- 原本の一部 ---")
            print(ref_text[:500])
            print("\n--- 出力の一部 ---")
            print(out_text[:500])

    except Exception as e:
        print(f"エラーが発生しました: {e}")

if __name__ == "__main__":
    main()
