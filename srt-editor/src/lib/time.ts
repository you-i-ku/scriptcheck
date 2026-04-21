export function parseTimecode(tc: string): number {
  const m = tc.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!m) throw new Error(`Invalid timecode: ${tc}`);
  const [, h, mn, s, ms] = m;
  return +h * 3600000 + +mn * 60000 + +s * 1000 + +ms;
}

export function formatTimecode(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const h = Math.floor(clamped / 3600000);
  const mn = Math.floor((clamped % 3600000) / 60000);
  const s = Math.floor((clamped % 60000) / 1000);
  const milli = clamped % 1000;
  return `${pad2(h)}:${pad2(mn)}:${pad2(s)},${pad3(milli)}`;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }
function pad3(n: number) { return String(n).padStart(3, '0'); }

export const msToSec = (ms: number) => ms / 1000;
export const secToMs = (s: number) => Math.round(s * 1000);
