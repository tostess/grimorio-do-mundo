import { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import type { AppState } from '../types';
import { appReducer, type Action } from './reducer';
import { loadWorldStateDB, saveWorldStateDB } from '../utils/storageDB';
import { useWorldStore } from './worldContext';

const UNDO_TRACKED = new Set<Action['type']>([
  'ADD_EVENT', 'UPDATE_EVENT', 'DELETE_EVENT',
  'ADD_ERA', 'DELETE_ERA',
  'ADD_CUSTOM_TYPE', 'DELETE_CUSTOM_TYPE',
  'ADD_SIGNIFICANCE', 'DELETE_SIGNIFICANCE',
  'ADD_WORLD_MAP', 'DELETE_WORLD_MAP',
  'ADD_MARKER', 'UPDATE_MARKER', 'DELETE_MARKER',
]);

interface AppContextType {
  state: AppState;
  dispatch: (action: Action) => void;
  savedAt: Date | null;
  canUndo: boolean;
  undo: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

// ── Async loader shell ────────────────────────────────────────────────────────

export function AppProvider({ children, worldId }: { children: ReactNode; worldId: string }) {
  const [initialState, setInitialState] = useState<AppState | null>(null);

  useEffect(() => {
    setInitialState(null);
    loadWorldStateDB(worldId).then(setInitialState).catch(console.error);
  }, [worldId]);

  if (!initialState) {
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
        Carregando campanha...
      </div>
    );
  }

  return (
    <AppProviderReady worldId={worldId} initialState={initialState}>
      {children}
    </AppProviderReady>
  );
}

// ── Provider with useReducer (mounted once initial state is loaded) ────────────

function AppProviderReady({
  children,
  worldId,
  initialState,
}: {
  children: ReactNode;
  worldId: string;
  initialState: AppState;
}) {
  const { updateWorldMeta } = useWorldStore();
  const [state, rawDispatch] = useReducer(appReducer, initialState);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef<AppState[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: Action) => {
    if (UNDO_TRACKED.has(action.type)) {
      historyRef.current = [...historyRef.current.slice(-19), stateRef.current];
      setCanUndo(true);
    }
    rawDispatch(action);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setCanUndo(historyRef.current.length > 0);
    rawDispatch({ type: 'IMPORT_STATE', payload: prev });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo]);

  useEffect(() => {
    saveWorldStateDB(worldId, state).catch(console.error);
    setSavedAt(new Date());
    updateWorldMeta(worldId, state.events.length);
  }, [state, worldId, updateWorldMeta]);

  return (
    <AppContext.Provider value={{ state, dispatch, savedAt, canUndo, undo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
