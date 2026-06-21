import type { AppState, GrimoireEvent, WorldMeta, Checkpoint } from '../types';
import { createDefaultState } from '../data/defaultState';
import { EVENT_IDEAS_DATA } from '../data/eventIdeas';
import { PROMPTS_DATA } from '../data/prompts';

// ── Keys ─────────────────────────────────────────────────────────────────────
const LEGACY_KEY = 'grimorio_state_v1';
const WORLDS_KEY = 'grimorio_worlds_v1';
const ACTIVE_WORLD_KEY = 'grimorio_active_world_v1';
const worldStateKey = (id: string) => `grimorio_world_${id}_v1`;
const worldHistoryKey = (id: string) => `grimorio_history_${id}_v1`;
const MAX_CHECKPOINTS = 10;

// ── World metadata ────────────────────────────────────────────────────────────
export function loadWorlds(): WorldMeta[] {
  try {
    const raw = localStorage.getItem(WORLDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorldMeta[];
  } catch {
    return [];
  }
}

export function saveWorlds(worlds: WorldMeta[]): void {
  try {
    localStorage.setItem(WORLDS_KEY, JSON.stringify(worlds));
  } catch { /* quota */ }
}

export function loadActiveWorldId(): string | null {
  return localStorage.getItem(ACTIVE_WORLD_KEY);
}

export function saveActiveWorldId(id: string | null): void {
  if (id === null) localStorage.removeItem(ACTIVE_WORLD_KEY);
  else localStorage.setItem(ACTIVE_WORLD_KEY, id);
}

// ── World state ───────────────────────────────────────────────────────────────
export function loadWorldState(worldId: string): AppState {
  try {
    const raw = localStorage.getItem(worldStateKey(worldId));
    if (!raw) return createDefaultState();
    return migrateState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return createDefaultState();
  }
}

export function saveWorldState(worldId: string, state: AppState): void {
  try {
    localStorage.setItem(worldStateKey(worldId), JSON.stringify(state));
  } catch { /* quota */ }
}

export function deleteWorldState(worldId: string): void {
  localStorage.removeItem(worldStateKey(worldId));
  localStorage.removeItem(worldHistoryKey(worldId));
}

// ── Checkpoints ───────────────────────────────────────────────────────────────
export function loadCheckpoints(worldId: string): Checkpoint[] {
  try {
    const raw = localStorage.getItem(worldHistoryKey(worldId));
    if (!raw) return [];
    return JSON.parse(raw) as Checkpoint[];
  } catch {
    return [];
  }
}

export function saveCheckpoints(worldId: string, checkpoints: Checkpoint[]): void {
  try {
    localStorage.setItem(worldHistoryKey(worldId), JSON.stringify(checkpoints));
  } catch { /* quota */ }
}

export function addCheckpoint(worldId: string, label: string, state: AppState): Checkpoint {
  const existing = loadCheckpoints(worldId);
  const cp: Checkpoint = {
    id: Date.now().toString(36),
    label,
    timestamp: new Date().toISOString(),
    eventCount: state.events.length,
    state,
  };
  const updated = [cp, ...existing].slice(0, MAX_CHECKPOINTS);
  saveCheckpoints(worldId, updated);
  return cp;
}

export function deleteCheckpointById(worldId: string, cpId: string): void {
  const existing = loadCheckpoints(worldId);
  saveCheckpoints(worldId, existing.filter(c => c.id !== cpId));
}

// ── Legacy migration ──────────────────────────────────────────────────────────
export function migrateLegacyIfNeeded(): { worlds: WorldMeta[]; activeId: string } | null {
  const hasNewFormat = localStorage.getItem(WORLDS_KEY) !== null;
  if (hasNewFormat) return null;

  const legacyRaw = localStorage.getItem(LEGACY_KEY);
  const worlds = loadWorlds();
  if (worlds.length > 0) return null;

  // First run with new code — create a world from legacy state (or fresh)
  const state = legacyRaw
    ? migrateState(JSON.parse(legacyRaw) as Partial<AppState>)
    : createDefaultState();

  const id = Date.now().toString(36);
  const now = new Date().toISOString();
  const meta: WorldMeta = {
    id,
    name: state.setup.worldName || 'Meu Mundo',
    createdAt: now,
    updatedAt: now,
    eventCount: state.events.length,
  };
  saveWorlds([meta]);
  saveWorldState(id, state);
  saveActiveWorldId(id);

  return { worlds: [meta], activeId: id };
}

// ── State migration ───────────────────────────────────────────────────────────
export function migrateState(partial: Partial<AppState>): AppState {
  const defaults = createDefaultState();

  const state: AppState = {
    meta: { ...defaults.meta, ...(partial.meta ?? {}) },
    setup: { ...defaults.setup, ...(partial.setup ?? {}) },
    eras: partial.eras?.length ? partial.eras : defaults.eras,
    customTypes: partial.customTypes ?? defaults.customTypes,
    significance: partial.significance?.length ? partial.significance : defaults.significance,
    events: (partial.events ?? defaults.events).map(e => {
      const ev = e as Partial<GrimoireEvent> & Pick<GrimoireEvent, 'id' | 'name' | 'era' | 'startYear'>;
      return { ...e, tags: ev.tags ?? [], masterNotes: ev.masterNotes ?? '', mapMarkerId: ev.mapMarkerId ?? null };
    }),
    prompts: mergePrompts(partial.prompts),
    ideas: mergeIdeas(partial.ideas),
    ui: {
      ...defaults.ui,
      ...(partial.ui ?? {}),
      filters: { ...defaults.ui.filters, ...(partial.ui?.filters ?? {}) },
    },
    counters: { ...defaults.counters, ...(partial.counters ?? {}) },
    worldMaps: partial.worldMaps ?? [],
    activeMapId: partial.activeMapId ?? null,
  };

  if (!state.setup.calendar) {
    state.setup.calendar = defaults.setup.calendar;
  }

  return state;
}

function mergePrompts(saved: AppState['prompts'] | undefined): AppState['prompts'] {
  if (!saved?.length) return PROMPTS_DATA.map(cat => ({ ...cat, items: cat.items.map(i => ({ ...i })) }));

  return PROMPTS_DATA.map(cat => {
    const savedCat = saved.find(s => s.category === cat.category);
    return {
      category: cat.category,
      items: cat.items.map(item => {
        const savedItem = savedCat?.items.find(s => s.id === item.id);
        return savedItem ? { ...item, done: savedItem.done, note: savedItem.note } : { ...item };
      }),
    };
  });
}

function mergeIdeas(saved: AppState['ideas'] | undefined): AppState['ideas'] {
  if (!saved?.length) return EVENT_IDEAS_DATA.map(cat => ({ ...cat, ideas: cat.ideas.map(i => ({ ...i })) }));

  return EVENT_IDEAS_DATA.map(cat => {
    const savedCat = saved.find(s => s.category === cat.category);
    return {
      category: cat.category,
      ideas: cat.ideas.map((idea, idx) => {
        const savedIdea = savedCat?.ideas[idx];
        return savedIdea ? { ...idea, used: savedIdea.used } : { ...idea };
      }),
    };
  });
}

// ── Export / Import ───────────────────────────────────────────────────────────
export function exportState(state: AppState): void {
  const worldName = state.setup.worldName.replace(/\s+/g, '-').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `grimorio-${worldName}-${date}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importState(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Partial<AppState>;
        resolve(migrateState(raw));
      } catch {
        reject(new Error('Arquivo inválido ou corrompido.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file);
  });
}
