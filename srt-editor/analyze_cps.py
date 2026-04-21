#!/usr/bin/env python3
"""SRTのCPS(文字/秒)を分析。違反行と分布を出す。"""
import re
import sys
import io

# Windows console でも日本語/記号を出せるようにstdoutをUTF-8に
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


def parse_tc(tc: str) -> int:
    m = re.match(r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})', tc)
    h, mn, s, ms = m.groups()
    return int(h) * 3600000 + int(mn) * 60000 + int(s) * 1000 + int(ms)


def main(path: str, threshold: float = 17.0) -> None:
    content = None
    used_enc = None
    for enc in ('utf-8-sig', 'utf-8', 'cp932', 'shift_jis'):
        try:
            with open(path, 'r', encoding=enc) as f:
                content = f.read()
            used_enc = enc
            break
        except UnicodeDecodeError:
            continue
    if content is None:
        print('decode failed')
        sys.exit(1)

    print(f'file: {path}')
    print(f'encoding: {used_enc}')
    print()

    entries = []
    for block in re.split(r'\n\n+', content.strip().replace('\r\n', '\n')):
        lines = block.strip().split('\n')
        if len(lines) < 2:
            continue
        try:
            seq = int(lines[0].strip())
        except ValueError:
            continue
        m = re.match(
            r'(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})',
            lines[1],
        )
        if not m:
            continue
        start = parse_tc(m.group(1))
        end = parse_tc(m.group(2))
        text = '\n'.join(lines[2:])
        chars = sum(1 for c in text if not c.isspace())
        duration_s = (end - start) / 1000.0
        cps = chars / duration_s if duration_s > 0 else 0.0
        entries.append({
            'seq': seq,
            'start_ms': start,
            'end_ms': end,
            'text': text,
            'chars': chars,
            'duration_s': duration_s,
            'cps': cps,
        })

    total = len(entries)
    violations = [e for e in entries if e['cps'] > threshold]
    warn = [e for e in entries if threshold >= e['cps'] > threshold * 0.8]

    print(f'total entries: {total}')
    print(f'CPS > {threshold} (violation): {len(violations)} ({len(violations)/total*100:.1f}%)')
    print(f'CPS > {threshold*0.8:.1f} (warn):      {len(warn)}  ({len(warn)/total*100:.1f}%)')
    print(f'max CPS: {max(e["cps"] for e in entries):.2f}')
    print(f'avg CPS: {sum(e["cps"] for e in entries)/total:.2f}')
    print()

    if violations:
        print(f'Top {min(10, len(violations))} violators:')
        for e in sorted(violations, key=lambda x: -x['cps'])[:10]:
            snippet = e['text'].replace('\n', ' / ')[:60]
            print(f'  #{e["seq"]:4d}  CPS={e["cps"]:5.2f}  '
                  f'({e["chars"]:3d}文字 / {e["duration_s"]:.2f}s)  {snippet}')
    else:
        print(f'✅ CPS {threshold} 超えなし')
    print()

    # 分布(1刻み)
    print(f'CPS distribution (bucket=1):')
    buckets = {}
    for e in entries:
        b = min(int(e['cps']), 29)
        buckets[b] = buckets.get(b, 0) + 1
    max_count = max(buckets.values()) if buckets else 1
    for i in range(0, 30):
        c = buckets.get(i, 0)
        bar_len = int(c / max_count * 40)
        bar = '█' * bar_len
        marker = '  ← threshold' if i == int(threshold) else ''
        print(f'  {i:2d}-{i+1:2d}: {c:4d} {bar}{marker}')


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else ''
    thr = float(sys.argv[2]) if len(sys.argv) > 2 else 17.0
    main(path, thr)
