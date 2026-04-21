export type SrtEncoding = 'utf-8-sig' | 'utf-8' | 'cp932' | 'shift_jis';

export type SrtEntry = {
  id: string;
  seq: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type SrtDocument = {
  entries: SrtEntry[];
  encoding: SrtEncoding;
  filename: string;
};

export type CharDialogue = { name: string; dialogue: string };

export type SessionSnapshot = {
  id: string;
  srtFilename: string;
  videoFilename?: string;
  encoding: SrtEncoding;
  entries: SrtEntry[];
  savedAt: number;
};
