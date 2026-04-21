import type { SrtEntry } from '../types';

export type SpeechRegion = { startMs: number; endMs: number };

export type SilenceDetectOptions = {
  windowMs: number;      // 解析窓(ms)
  thresholdDb: number;   // これ以上を発話とみなす(例: -35)
  minSpeechMs: number;   // 最短発話長(これ未満はノイズ扱い)
};

export const DEFAULT_SILENCE_OPTIONS: SilenceDetectOptions = {
  windowMs: 80,
  thresholdDb: -35,
  minSpeechMs: 400,
};

/**
 * 音声バッファから「発話らしき区間」を抽出し、既存字幕でカバーされていないものを返す。
 * エコー補完(SRT抜け)の候補になる。
 */
export function findUncoveredSpeechRegions(
  audioBuffer: AudioBuffer,
  entries: SrtEntry[],
  opts: SilenceDetectOptions = DEFAULT_SILENCE_OPTIONS,
): SpeechRegion[] {
  const sr = audioBuffer.sampleRate;
  const windowSamples = Math.max(1, Math.floor((opts.windowMs / 1000) * sr));
  const channels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const numWindows = Math.ceil(totalSamples / windowSamples);
  const rms = new Float32Array(numWindows);
  const rmsThreshold = Math.pow(10, opts.thresholdDb / 20);

  for (let c = 0; c < channels; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let w = 0; w < numWindows; w += 1) {
      let sum = 0;
      const startSample = w * windowSamples;
      const endSample = Math.min(startSample + windowSamples, totalSamples);
      for (let i = startSample; i < endSample; i += 1) {
        const v = data[i];
        sum += v * v;
      }
      rms[w] += sum / (endSample - startSample);
    }
  }
  for (let w = 0; w < numWindows; w += 1) {
    rms[w] = Math.sqrt(rms[w] / channels);
  }

  const speech: SpeechRegion[] = [];
  let inSpeech = false;
  let regionStart = 0;
  for (let w = 0; w < numWindows; w += 1) {
    const isLoud = rms[w] > rmsThreshold;
    if (isLoud && !inSpeech) {
      regionStart = w * opts.windowMs;
      inSpeech = true;
    } else if (!isLoud && inSpeech) {
      const regionEnd = w * opts.windowMs;
      if (regionEnd - regionStart >= opts.minSpeechMs) {
        speech.push({ startMs: regionStart, endMs: regionEnd });
      }
      inSpeech = false;
    }
  }
  if (inSpeech) {
    const endMs = numWindows * opts.windowMs;
    if (endMs - regionStart >= opts.minSpeechMs) {
      speech.push({ startMs: regionStart, endMs });
    }
  }

  // 字幕でカバーされていない発話だけ返す(20%以上被ってたらカバー扱い)
  const uncovered: SpeechRegion[] = [];
  for (const s of speech) {
    const dur = s.endMs - s.startMs;
    let covered = 0;
    for (const e of entries) {
      const overlap = Math.max(0, Math.min(e.endMs, s.endMs) - Math.max(e.startMs, s.startMs));
      covered += overlap;
    }
    if (covered / dur < 0.2) uncovered.push(s);
  }
  return uncovered;
}

/**
 * <video>要素から AudioBuffer を生成。OfflineAudioContext で一度だけデコード。
 */
export async function decodeVideoAudio(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    void ctx.close();
  }
}
