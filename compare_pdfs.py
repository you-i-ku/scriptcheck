import pdfplumber
import sys

def extract_text(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        full_text = []
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)
        return "\n".join(full_text)

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    pdf1_path = 'pdf-format/20260321_恋は雨上がりのように_S01E06_「沙雨（さう）」.pdf'
    pdf2_path = 'output/20260327_恋は雨上がりのように_S01E06_沙雨 (さう).ja.closedcaptions.pdf'

    print("--- PDF 1 (Reference) ---")
    text1 = extract_text(pdf1_path)
    print(text1)

    print("\n--- PDF 2 (Generated) ---")
    text2 = extract_text(pdf2_path)
    print(text2)

if __name__ == "__main__":
    main()
