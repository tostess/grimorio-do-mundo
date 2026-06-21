import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AppState, WorldMeta, Checkpoint } from '../types';
import { initDB } from '../utils/db';
import {
  loadWorldsDB, upsertWorldDB, deleteWorldFromDB,
  loadActiveWorldIdDB, saveActiveWorldIdDB,
  loadCheckpointsDB,
  addCheckpointDB, deleteCheckpointByIdDB,
  migrateLegacyIfNeededDB, createWorldDB,
} from '../utils/storageDB';

interface WorldContextType {
  worlds: WorldMeta[];
  activeWorldId: string | null;
  checkpoints: Checkpoint[];
  dbReady: boolean;
  createWorld: (name: string) => string;
  deleteWorld: (id: string) => void;
  renameWorld: (id: string, name: string) => void;
  switchWorld: (id: string) => void;
  updateWorldMeta: (id: string, eventCount: number) => void;
  saveCheckpoint: (label: string, state: AppState) => void;
  restoreCheckpoint: (cp: Checkpoint) => AppState;
  deleteCheckpoint: (cpId: string) => void;
}

const WorldContext = createContext<WorldContextType | null>(null);

export function WorldProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false);
  const [worlds, setWorlds] = useState<WorldMeta[]>([]);
  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  useEffect(() => {
    initDB()
      .then(() => migrateLegacyIfNeededDB())
      .then(async migrated => {
        if (migrated) {
          setWorlds(migrated.worlds);
          setActiveWorldId(migrated.activeId);
          setCheckpoints(await loadCheckpointsDB(migrated.activeId));
        } else {
          const [ws, aid] = await Promise.all([loadWorldsDB(), loadActiveWorldIdDB()]);
          setWorlds(ws);
          setActiveWorldId(aid);
          if (aid) setCheckpoints(await loadCheckpointsDB(aid));
        }
      })
      .catch(err => {
        console.error('SQLite init failed, starting fresh:', err);
      })
      .finally(() => setDbReady(true));
  }, []);

  const createWorld = useCallback((name: string): string => {
    // Generate ID synchronously so the return value is immediate
    const id = Date.now().toString(36);
    const now = new Date().toISOString();
    const meta: WorldMeta = { id, name, createdAt: now, updatedAt: now, eventCount: 0 };

    createWorldDB(name)
      .then(result => {
        // Overwrite with the DB-generated id/state if different (should be same)
        void result;
      })
      .catch(console.error);

    setWorlds(prev => {
      // Persist the updated list's active world to DB
      upsertWorldDB(meta).catch(console.error);
      return [...prev, meta];
    });
    return id;
  }, []);

  const deleteWorld = useCallback((id: string) => {
    deleteWorldFromDB(id).catch(console.error);
    setWorlds(prev => {
      const next = prev.filter(w => w.id !== id);
      if (activeWorldId === id) {
        const newActive = next[0]?.id ?? null;
        setActiveWorldId(newActive);
        saveActiveWorldIdDB(newActive).catch(console.error);
        if (newActive) {
          loadCheckpointsDB(newActive).then(setCheckpoints).catch(console.error);
        } else {
          setCheckpoints([]);
        }
      }
      return next;
    });
  }, [activeWorldId]);

  const renameWorld = useCallback((id: string, name: string) => {
    setWorlds(prev => {
      const next = prev.map(w =>
        w.id === id ? { ...w, name, updatedAt: new Date().toISOString() } : w,
      );
      const updated = next.find(w => w.id === id);
      if (updated) upsertWorldDB(updated).catch(console.error);
      return next;
    });
  }, []);

  const switchWorld = useCallback((id: string) => {
    setActiveWorldId(id);
    saveActiveWorldIdDB(id).catch(console.error);
    loadCheckpointsDB(id).then(setCheckpoints).catch(console.error);
  }, []);

  const updateWorldMeta = useCallback((id: string, eventCount: number) => {
    setWorlds(prev => {
      const next = prev.map(w =>
        w.id === id ? { ...w, eventCount, updatedAt: new Date().toISOString() } : w,
      );
      const updated = next.find(w => w.id === id);
      if (updated) upsertWorldDB(updated).catch(console.error);
      return next;
    });
  }, []);

  const saveCheckpoint = useCallback((label: string, state: AppState) => {
    if (!activeWorldId) return;
    addCheckpointDB(activeWorldId, label, state)
      .then(cp => setCheckpoints(prev => [cp, ...prev].slice(0, 10)))
      .catch(console.error);
  }, [activeWorldId]);

  const restoreCheckpoint = useCallback((cp: Checkpoint): AppState => {
    return cp.state;
  }, []);

  const deleteCheckpoint = useCallback((cpId: string) => {
    if (!activeWorldId) return;
    deleteCheckpointByIdDB(activeWorldId, cpId).catch(console.error);
    setCheckpoints(prev => prev.filter(c => c.id !== cpId));
  }, [activeWorldId]);

  if (!dbReady) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg, #0d0d12)',
        color: 'var(--gold, #c9a84c)',
        fontFamily: 'serif',
        fontSize: '1.1rem',
        letterSpacing: '0.05em',
      }}>
        Inicializando banco de dados...
      </div>
    );
  }

  return (
    <WorldContext.Provider value={{
      worlds,
      activeWorldId,
      checkpoints,
      dbReady,
      createWorld,
      deleteWorld,
      renameWorld,
      switchWorld,
      updateWorldMeta,
      saveCheckpoint,
      restoreCheckpoint,
      deleteCheckpoint,
    }}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorldStore(): WorldContextType {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorldStore must be used within WorldProvider');
  return ctx;
}
