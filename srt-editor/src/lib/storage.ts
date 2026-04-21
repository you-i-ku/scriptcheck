import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SessionSnapshot } from '../types';

interface SrtEditorDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionSnapshot;
  };
}

const DB_NAME = 'srt-editor';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SrtEditorDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SrtEditorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSession(snapshot: Omit<SessionSnapshot, 'savedAt'>) {
  const db = await getDb();
  await db.put('sessions', { ...snapshot, savedAt: Date.now() });
}

export async function loadLatestSession(): Promise<SessionSnapshot | null> {
  const db = await getDb();
  const all = await db.getAll('sessions');
  if (all.length === 0) return null;
  return all.sort((a, b) => b.savedAt - a.savedAt)[0];
}

export async function loadSession(id: string): Promise<SessionSnapshot | null> {
  const db = await getDb();
  return (await db.get('sessions', id)) ?? null;
}

export async function deleteSession(id: string) {
  const db = await getDb();
  await db.delete('sessions', id);
}
