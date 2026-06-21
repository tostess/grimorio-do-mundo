import * as SQLite from 'wa-sqlite';
// Use the synchronous WASM build — MemoryVFS is sync, no Asyncify needed.
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { MemoryVFS } from 'wa-sqlite/src/examples/MemoryVFS.js';

type WaSQLite = ReturnType<typeof SQLite.Factory>;

const DB_FILENAME = 'grimorio.db';
// The IDB database used for persisting the SQLite binary.
const IDB_DB_NAME = 'grimorio-sqlite';
const IDB_STORE = 'db';
const IDB_KEY = 'main';

let _sqlite3: WaSQLite | null = null;
let _db: number | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _vfs: any = null;
let _initPromise: Promise<void> | null = null;

// Serializes all DB ops to prevent concurrent prepare_v2 calls from
// corrupting the shared tmpPtr buffer inside wa-sqlite's Factory.
let _opQueue = Promise.resolve();
function _enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = _opQueue.then(fn);
  _opQueue = next.then(
    () => {},
    () => {}, // keep queue alive on error
  );
  return next;
}

export function initDB(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = _boot();
  return _initPromise;
}

async function _boot(): Promise<void> {
  const module = await (SQLiteESMFactory as () => Promise<object>)();
  _sqlite3 = SQLite.Factory(module);

  _vfs = new MemoryVFS();
  _sqlite3.vfs_register(_vfs, true);

  // Restore persisted database from IndexedDB if it exists.
  const saved = await _idbLoad();
  if (saved) {
    _vfs.mapNameToFile.set(DB_FILENAME, {
      name: DB_FILENAME,
      flags: SQLite.SQLITE_OPEN_READWRITE,
      size: saved.byteLength,
      data: saved,
    });
  }

  _db = await _sqlite3.open_v2(
    DB_FILENAME,
    SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE,
  );

  await _sqlite3.exec(_db, `
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS active_world (
      singleton INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
      world_id TEXT
    );
    CREATE TABLE IF NOT EXISTS world_states (
      world_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      label TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoints_world
      ON checkpoints (world_id, timestamp DESC);
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      player_name TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_characters_world ON characters (world_id);
  `);
}

// ── IDB persistence ───────────────────────────────────────────────────────────

function _idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _idbLoad(): Promise<ArrayBuffer | null> {
  try {
    const idb = await _idbOpen();
    return new Promise((resolve) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function persistDB(): Promise<void> {
  if (!_vfs) return;
  const file = _vfs.mapNameToFile.get(DB_FILENAME) as { data: ArrayBuffer } | undefined;
  if (!file) return;
  try {
    const idb = await _idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const req = tx.objectStore(IDB_STORE).put(file.data.slice(0), IDB_KEY);
      tx.oncomplete = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('SQLite persist failed:', err);
  }
}

// ── Serialized query helpers ──────────────────────────────────────────────────

function ctx(): { s: WaSQLite; db: number } {
  if (!_sqlite3 || _db === null) throw new Error('DB not initialized — call initDB() first');
  return { s: _sqlite3, db: _db };
}

type Bind = string | number | bigint | Uint8Array | null;

export function dbRun(sql: string, params?: Bind[]): Promise<void> {
  return _enqueue(async () => {
    const { s, db } = ctx();
    await s.run(db, sql, params);
  });
}

export function dbQuery<T extends Record<string, Bind>>(
  sql: string,
  params?: Bind[],
): Promise<T[]> {
  return _enqueue(async () => {
    const { s, db } = ctx();
    const { rows, columns } = await s.execWithParams(db, sql, params);
    return rows.map(row => {
      const obj: Record<string, Bind> = {};
      columns.forEach((col, i) => { obj[col] = row[i] as Bind; });
      return obj as T;
    });
  });
}

export function dbExec(sql: string): Promise<void> {
  return _enqueue(async () => {
    const { s, db } = ctx();
    await s.exec(db, sql);
  });
}
