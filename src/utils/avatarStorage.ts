export interface AvatarEntry {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

const IDB_NAME = 'grimorio-avatars';
const IDB_STORE = 'avatars';
const IDB_VERSION = 1;

function openAvatarsIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAvatars(): Promise<AvatarEntry[]> {
  const db = await openAvatarsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as AvatarEntry[]).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
      );
    req.onerror = () => reject(req.error);
  });
}

export async function saveAvatar(entry: AvatarEntry): Promise<void> {
  const db = await openAvatarsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAvatar(id: string): Promise<void> {
  const db = await openAvatarsIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
