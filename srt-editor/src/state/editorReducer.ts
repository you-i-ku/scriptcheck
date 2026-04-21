import type { SrtEntry, SrtEncoding } from '../types';

export type EditorState = {
  entries: SrtEntry[];
  encoding: SrtEncoding;
  srtName: string | null;
};

export const EMPTY_STATE: EditorState = {
  entries: [],
  encoding: 'utf-8-sig',
  srtName: null,
};

export type HistoryEntry = {
  state: EditorState;
  coalesceKey: string | null;
  timestamp: number;
};

export type HistoryState = {
  past: HistoryEntry[];
  present: EditorState;
  future: HistoryEntry[];
};

export const INITIAL_HISTORY: HistoryState = {
  past: [],
  present: EMPTY_STATE,
  future: [],
};

export type Action =
  | { type: 'LOAD'; payload: EditorState }
  | { type: 'PATCH_ENTRY'; id: string; patch: Partial<SrtEntry>; coalesceKey?: string }
  | { type: 'INSERT_AFTER'; afterId: string | null; newEntry: SrtEntry; selectId?: string }
  | { type: 'INSERT_AT_TIME'; startMs: number; endMs: number; newId: string }
  | { type: 'SPLIT'; id: string; charIndex: number; timeMs: number; newId: string }
  | { type: 'MERGE_WITH_NEXT'; id: string }
  | { type: 'DELETE'; id: string }
  | { type: 'TIMESHIFT_ALL'; deltaMs: number }
  | { type: 'TIMESHIFT_FROM'; fromId: string; deltaMs: number }
  | { type: 'REPLACE_ALL'; pattern: string; flags: string; replacement: string }
  | { type: 'NORMALIZE_SPEAKER_TAGS'; style: 'fullwidth' | 'halfwidth' }
  | { type: 'UNDO' }
  | { type: 'REDO' };

const MAX_HISTORY = 100;
const COALESCE_MS = 800;

export function editorReducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    const snapshot: HistoryEntry = {
      state: state.present, coalesceKey: null, timestamp: Date.now(),
    };
    return {
      past: state.past.slice(0, -1),
      present: prev.state,
      future: [...state.future, snapshot],
    };
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const next = state.future[state.future.length - 1];
    const snapshot: HistoryEntry = {
      state: state.present, coalesceKey: null, timestamp: Date.now(),
    };
    return {
      past: [...state.past, snapshot],
      present: next.state,
      future: state.future.slice(0, -1),
    };
  }
  if (action.type === 'LOAD') {
    return { past: [], present: action.payload, future: [] };
  }

  const newPresent = applyAction(state.present, action);
  if (newPresent === state.present) return state;

  const coalesceKey = action.type === 'PATCH_ENTRY' ? action.coalesceKey ?? null : null;
  const now = Date.now();

  let past = state.past;
  if (coalesceKey && past.length > 0) {
    const last = past[past.length - 1];
    if (last.coalesceKey === coalesceKey && now - last.timestamp < COALESCE_MS) {
      past = past.slice(0, -1).concat([{ ...last, timestamp: now }]);
      return { past, present: newPresent, future: [] };
    }
  }

  const snapshot: HistoryEntry = { state: state.present, coalesceKey, timestamp: now };
  past = [...past, snapshot];
  if (past.length > MAX_HISTORY) past = past.slice(past.length - MAX_HISTORY);

  return { past, present: newPresent, future: [] };
}

function applyAction(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'PATCH_ENTRY': {
      const entries = state.entries.map(
        (e) => (e.id === action.id ? { ...e, ...action.patch } : e),
      );
      return { ...state, entries };
    }
    case 'INSERT_AFTER': {
      const idx = action.afterId === null
        ? -1
        : state.entries.findIndex((e) => e.id === action.afterId);
      const insertPos = idx + 1;
      const entries = [
        ...state.entries.slice(0, insertPos),
        action.newEntry,
        ...state.entries.slice(insertPos),
      ];
      return { ...state, entries };
    }
    case 'INSERT_AT_TIME': {
      const newEntry: SrtEntry = {
        id: action.newId,
        seq: 0,
        startMs: action.startMs,
        endMs: action.endMs,
        text: '',
      };
      let idx = state.entries.findIndex((e) => e.startMs > action.startMs);
      if (idx < 0) idx = state.entries.length;
      const entries = [
        ...state.entries.slice(0, idx),
        newEntry,
        ...state.entries.slice(idx),
      ];
      return { ...state, entries };
    }
    case 'SPLIT': {
      const idx = state.entries.findIndex((e) => e.id === action.id);
      if (idx < 0) return state;
      const e = state.entries[idx];
      const before = e.text.slice(0, action.charIndex);
      const after = e.text.slice(action.charIndex);
      const splitE: SrtEntry = { ...e, text: before, endMs: action.timeMs };
      const newE: SrtEntry = {
        id: action.newId,
        seq: 0,
        startMs: action.timeMs,
        endMs: e.endMs,
        text: after,
      };
      const entries = [
        ...state.entries.slice(0, idx),
        splitE,
        newE,
        ...state.entries.slice(idx + 1),
      ];
      return { ...state, entries };
    }
    case 'MERGE_WITH_NEXT': {
      const idx = state.entries.findIndex((e) => e.id === action.id);
      if (idx < 0 || idx === state.entries.length - 1) return state;
      const e = state.entries[idx];
      const next = state.entries[idx + 1];
      const merged: SrtEntry = {
        ...e,
        endMs: next.endMs,
        text: `${e.text}\n${next.text}`.trim(),
      };
      const entries = [
        ...state.entries.slice(0, idx),
        merged,
        ...state.entries.slice(idx + 2),
      ];
      return { ...state, entries };
    }
    case 'DELETE': {
      const entries = state.entries.filter((e) => e.id !== action.id);
      return { ...state, entries };
    }
    case 'TIMESHIFT_ALL': {
      const entries = state.entries.map((e) => ({
        ...e,
        startMs: Math.max(0, e.startMs + action.deltaMs),
        endMs: Math.max(0, e.endMs + action.deltaMs),
      }));
      return { ...state, entries };
    }
    case 'TIMESHIFT_FROM': {
      const startIdx = state.entries.findIndex((e) => e.id === action.fromId);
      if (startIdx < 0) return state;
      const entries = state.entries.map((e, i) =>
        i >= startIdx
          ? {
              ...e,
              startMs: Math.max(0, e.startMs + action.deltaMs),
              endMs: Math.max(0, e.endMs + action.deltaMs),
            }
          : e,
      );
      return { ...state, entries };
    }
    case 'REPLACE_ALL': {
      let regex: RegExp;
      try {
        regex = new RegExp(action.pattern, action.flags);
      } catch {
        return state;
      }
      const entries = state.entries.map((e) => ({
        ...e,
        text: e.text.replace(regex, action.replacement),
      }));
      return { ...state, entries };
    }
    case 'NORMALIZE_SPEAKER_TAGS': {
      const open = action.style === 'fullwidth' ? '（' : '(';
      const close = action.style === 'fullwidth' ? '）' : ')';
      const entries = state.entries.map((e) => ({
        ...e,
        text: e.text.replace(
          /^[(（]([^)）]+)[)）]/gm,
          (_, name) => `${open}${name}${close}`,
        ),
      }));
      return { ...state, entries };
    }
    default:
      return state;
  }
}

export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;
