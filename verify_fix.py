import pdfplumber
import sys

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    path = 'output/20260329_恋は雨上がりのように_S01E06_沙雨 (さう).ja.closedcaptions.pdf'
    
    with pdfplumber.open(path) as pdf:
        all_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                all_text += text + "\n"
        
        lines = all_text.split('\n')
        
        print("--- セクション 51 周辺 ---")
        found_51 = False
        for i, line in enumerate(lines):
            if '51' in line:
                print("\n".join(lines[max(0, i-2):i+10]))
                found_51 = True
                break
        
        print("\n--- セクション 130 周辺 ---")
        found_130 = False
        for i, line in enumerate(lines):
            if '130' in line:
                print("\n".join(lines[max(0, i-2):i+10]))
                found_130 = True
                break

if __name__ == "__main__":
    main()
