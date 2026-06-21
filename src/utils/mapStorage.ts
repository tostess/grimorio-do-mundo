export interface MapImageMeta {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  createdAt: string;
}

const IDB_NAME = 'grimorio-maps';
const META_STORE = 'meta';
const DATA_STORE = 'data';
const IDB_VERSION = 1;

function openMapsIDB(): Promise<IDBDatabase> {
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

export async function addMapImageDB(meta: MapImageMeta, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await openMapsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(DATA_STORE).put(arrayBuffer, meta.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMapImageDB(id: string): Promise<{ meta: MapImageMeta; buffer: ArrayBuffer } | null> {
  const db = await openMapsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readonly');
    const metaReq = tx.objectStore(META_STORE).get(id);
    const dataReq = tx.objectStore(DATA_STORE).get(id);
    let meta: MapImageMeta | undefined;
    let buffer: ArrayBuffer | undefined;
    metaReq.onsuccess = () => { meta = metaReq.result as MapImageMeta | undefined; };
    dataReq.onsuccess = () => { buffer = dataReq.result as ArrayBuffer | undefined; };
    tx.oncomplete = () => {
      if (!meta || !buffer) resolve(null);
      else resolve({ meta, buffer });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMapImageUrl(id: string): Promise<string | null> {
  const result = await getMapImageDB(id);
  if (!result) return null;
  const blob = new Blob([result.buffer], { type: result.meta.mime });
  return URL.createObjectURL(blob);
}

export async function deleteMapImageDB(id: string): Promise<void> {
  const db = await openMapsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(DATA_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = reject;
    img.src = url;
  });
}
