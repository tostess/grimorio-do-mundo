export interface AudioMeta {
  id: string;
  label: string;
  kind: 'ambient' | 'sfx';
  mime: string;
  durationSec?: number;
  origin: 'imported' | 'received';
  createdAt: string;
}

const IDB_NAME = 'grimorio-audio';
const META_STORE = 'meta';
const DATA_STORE = 'data';
const IDB_VERSION = 1;

function openAudioIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addAudioDB(meta: AudioMeta, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await openAudioIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(DATA_STORE).put(arrayBuffer, meta.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listAudioDB(): Promise<AudioMeta[]> {
  const db = await openAudioIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as AudioMeta[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    req.onerror = () => reject(req.error);
  });
}

export async function getAudioBufferDB(id: string): Promise<ArrayBuffer | null> {
  const db = await openAudioIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DATA_STORE, 'readonly');
    const req = tx.objectStore(DATA_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioDB(id: string): Promise<void> {
  const db = await openAudioIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(DATA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
