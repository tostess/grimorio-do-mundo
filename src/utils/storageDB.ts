import type { AppState, WorldMeta, Checkpoint } from '../types';
import type { Character } from '../types/character';
import { dbRun, dbQuery, dbExec, persistDB } from './db';
import { migrateState, migrateLegacyIfNeeded, loadWorlds, loadActiveWorldId, loadWorldState, loadCheckpoints } from './storage';
import { createDefaultState } from '../data/defaultState';

const MAX_CHECKPOINTS = 10;

// ── Worlds ────────────────────────────────────────────────────────────────────

export async function loadWorldsDB(): Promise<WorldMeta[]> {
  const rows = await dbQuery<{
    id: string; name: string; created_at: string; updated_at: string; event_count: number;
  }>('SELECT id, name, created_at, updated_at, event_count FROM worlds ORDER BY created_at');
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    eventCount: r.event_count as number,
  }));
}

export async function upsertWorldDB(world: WorldMeta): Promise<void> {
  await dbRun(
    `INSERT OR REPLACE INTO worlds (id, name, created_at, updated_at, event_count)
     VALUES (?, ?, ?, ?, ?)`,
    [world.id, world.name, world.createdAt, world.updatedAt, world.eventCount],
  );
}

export async function deleteWorldFromDB(id: string): Promise<void> {
  await dbRun('DELETE FROM worlds WHERE id = ?', [id]);
  await dbRun('DELETE FROM world_states WHERE world_id = ?', [id]);
  await dbRun('DELETE FROM checkpoints WHERE world_id = ?', [id]);
}

// ── Active world ──────────────────────────────────────────────────────────────

export async function loadActiveWorldIdDB(): Promise<string | null> {
  const rows = await dbQuery<{ world_id: string | null }>(
    'SELECT world_id FROM active_world WHERE singleton = 1',
  );
  return (rows[0]?.world_id as string | null) ?? null;
}

export async function saveActiveWorldIdDB(id: string | null): Promise<void> {
  await dbRun(
    'INSERT OR REPLACE INTO active_world (singleton, world_id) VALUES (1, ?)',
    [id],
  );
}

// ── World state ───────────────────────────────────────────────────────────────

export async function loadWorldStateDB(worldId: string): Promise<AppState> {
  const rows = await dbQuery<{ state_json: string }>(
    'SELECT state_json FROM world_states WHERE world_id = ?',
    [worldId],
  );
  if (!rows[0]) return createDefaultState();
  try {
    return migrateState(JSON.parse(rows[0].state_json as string) as Partial<AppState>);
  } catch {
    return createDefaultState();
  }
}

export async function saveWorldStateDB(worldId: string, state: AppState): Promise<void> {
  await dbRun(
    'INSERT OR REPLACE INTO world_states (world_id, state_json) VALUES (?, ?)',
    [worldId, JSON.stringify(state)],
  );
  persistDB().catch(console.warn);
}

// ── Checkpoints ───────────────────────────────────────────────────────────────

export async function loadCheckpointsDB(worldId: string): Promise<Checkpoint[]> {
  const rows = await dbQuery<{
    id: string; label: string; timestamp: string; event_count: number; state_json: string;
  }>(
    `SELECT id, label, timestamp, event_count, state_json
     FROM checkpoints WHERE world_id = ? ORDER BY timestamp DESC`,
    [worldId],
  );
  return rows.map(r => ({
    id: r.id as string,
    label: r.label as string,
    timestamp: r.timestamp as string,
    eventCount: r.event_count as number,
    state: JSON.parse(r.state_json as string) as AppState,
  }));
}

export async function addCheckpointDB(
  worldId: string,
  label: string,
  state: AppState,
): Promise<Checkpoint> {
  const cp: Checkpoint = {
    id: Date.now().toString(36),
    label,
    timestamp: new Date().toISOString(),
    eventCount: state.events.length,
    state,
  };

  await dbRun(
    `INSERT INTO checkpoints (id, world_id, label, timestamp, event_count, state_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cp.id, worldId, cp.label, cp.timestamp, cp.eventCount, JSON.stringify(cp.state)],
  );

  // Trim to MAX_CHECKPOINTS, keeping the newest
  await dbExec(`
    DELETE FROM checkpoints
    WHERE world_id = '${worldId}'
      AND id NOT IN (
        SELECT id FROM checkpoints
        WHERE world_id = '${worldId}'
        ORDER BY timestamp DESC
        LIMIT ${MAX_CHECKPOINTS}
      )
  `);

  return cp;
}

export async function deleteCheckpointByIdDB(worldId: string, cpId: string): Promise<void> {
  await dbRun('DELETE FROM checkpoints WHERE id = ? AND world_id = ?', [cpId, worldId]);
}

// ── Legacy migration (localStorage → SQLite) ──────────────────────────────────

// Singleton: React StrictMode mounts effects twice — this ensures migration
// only runs once even when called concurrently.
let _migrationPromise: Promise<{ worlds: WorldMeta[]; activeId: string } | null> | null = null;

export function migrateLegacyIfNeededDB(): Promise<{ worlds: WorldMeta[]; activeId: string } | null> {
  if (_migrationPromise) return _migrationPromise;
  _migrationPromise = _doMigrate();
  return _migrationPromise;
}

async function _doMigrate(): Promise<{ worlds: WorldMeta[]; activeId: string } | null> {
  const existing = await loadWorldsDB();
  if (existing.length > 0) return null; // SQLite already has data

  // Handle old single-world localStorage format → new multi-world format
  migrateLegacyIfNeeded();

  const lsWorlds = loadWorlds();
  if (lsWorlds.length === 0) return null; // nothing to migrate

  const lsActiveId = loadActiveWorldId() ?? lsWorlds[0].id;

  // Copy each world to SQLite
  for (const world of lsWorlds) {
    await upsertWorldDB(world);
    const state = loadWorldState(world.id);
    await saveWorldStateDB(world.id, state);

    const cps = loadCheckpoints(world.id);
    for (const cp of cps) {
      await dbRun(
        `INSERT OR IGNORE INTO checkpoints (id, world_id, label, timestamp, event_count, state_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cp.id, world.id, cp.label, cp.timestamp, cp.eventCount, JSON.stringify(cp.state)],
      );
    }
  }
  await saveActiveWorldIdDB(lsActiveId);
  await persistDB();

  return { worlds: lsWorlds, activeId: lsActiveId };
}

// ── Fresh world helper ────────────────────────────────────────────────────────

export async function createWorldDB(name: string): Promise<{ id: string; meta: WorldMeta; state: AppState }> {
  const id = Date.now().toString(36);
  const now = new Date().toISOString();
  const meta: WorldMeta = { id, name, createdAt: now, updatedAt: now, eventCount: 0 };
  const state = createDefaultState();
  state.setup.worldName = name;

  await upsertWorldDB(meta);
  await saveWorldStateDB(id, state);

  return { id, meta, state };
}

// ── Characters ────────────────────────────────────────────────────────────────

export async function loadCharactersDB(worldId: string): Promise<Character[]> {
  const rows = await dbQuery<{ data_json: string }>(
    'SELECT data_json FROM characters WHERE world_id = ? ORDER BY rowid',
    [worldId],
  );
  return rows.map(r => JSON.parse(r.data_json as string) as Character);
}

export async function upsertCharacterDB(char: Character): Promise<void> {
  await dbRun(
    `INSERT OR REPLACE INTO characters (id, world_id, player_name, data_json)
     VALUES (?, ?, ?, ?)`,
    [char.id, char.worldId, char.playerName, JSON.stringify(char)],
  );
  persistDB().catch(console.warn);
}

export async function deleteCharacterDB(id: string): Promise<void> {
  await dbRun('DELETE FROM characters WHERE id = ?', [id]);
  persistDB().catch(console.warn);
}
