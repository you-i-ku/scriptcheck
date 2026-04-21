import Encoding from 'encoding-japanese';
import type { SrtEncoding } from '../types';

export function decodeSrt(buf: ArrayBuffer): { text: string; encoding: SrtEncoding } {
  const bytes = new Uint8Array(buf);

  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      encoding: 'utf-8-sig',
    };
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8' };
  } catch {
    // fall through to SJIS detection
  }

  const detected = Encoding.detect(bytes);
  const from = detected === 'SJIS' || detected === 'UTF8' || detected === 'EUCJP' || detected === 'JIS'
    ? detected
    : 'SJIS';

  const unicode = Encoding.convert(bytes, { to: 'UNICODE', from, type: 'string' }) as string;
  const encoding: SrtEncoding = detected === 'SJIS' ? 'cp932' : 'shift_jis';
  return { text: unicode, encoding };
}

export function encodeSrt(text: string, encoding: SrtEncoding): Uint8Array {
  if (encoding === 'utf-8-sig') {
    const utf8 = new TextEncoder().encode(text);
    const out = new Uint8Array(utf8.length + 3);
    out[0] = 0xEF; out[1] = 0xBB; out[2] = 0xBF;
    out.set(utf8, 3);
    return out;
  }
  if (encoding === 'utf-8') {
    return new TextEncoder().encode(text);
  }
  const codes = Encoding.convert(text, { to: 'SJIS', from: 'UNICODE', type: 'array' }) as number[];
  return new Uint8Array(codes);
}
