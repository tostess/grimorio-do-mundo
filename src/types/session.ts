import type { MapMarker } from './worldmap';

export type SessionRole = 'host' | 'guest' | 'offline';

export interface PeerInfo {
  peerId: string;
  playerName: string;
  characterId: string | null;
  connected: boolean;
}

export interface AssignedCharacter {
  id: string;
  playerName: string;
  avatarId?: string;
  avatarDataUrl?: string;
  name: string;
  race: string;
  class: string;
  subclass: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  conditions: string[];
  attacks: Array<{ id: string; name: string; bonus: string; damage: string; damageType: string; range: string; notes: string }>;
  spells: Array<{ id: string; name: string; level: number; school: string; prepared: boolean; description: string }>;
  classResources: Array<{ id: string; name: string; current: number; max: number; rechargeOn: string }>;
}

export interface InitiativeEntry {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  hpMax: number;
  ac: number;
  isNPC: boolean;
  conditions: string[];
  peerId?: string;
  characterId?: string;
}

export interface CombatState {
  active: boolean;
  round: number;
  currentTurnIndex: number;
  entries: InitiativeEntry[];
}

export interface AudioState {
  active: Record<string, { playing: boolean; volume: number; loop: boolean }>;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  peerId: string;
  playerName: string;
  type: 'chat' | 'dice' | 'system';
  text: string;
  diceNotation?: string;
  diceTotal?: number;
  diceBreakdown?: string;
}

export interface Token {
  id: string;
  characterId: string | null;
  name: string;
  x: number;
  y: number;
  color: string;
  initials: string;
}

export interface PlayerPin {
  peerId: string;
  playerName: string;
  color: string;
  x: number;
  y: number;
}

export interface SharedMap {
  mapId: string;
  imageRefId: string;
  width: number;
  height: number;
  markers: MapMarker[];
}

export interface SessionSnapshot {
  peers: PeerInfo[];
  assignedCharacters: Record<string, AssignedCharacter>;
  combat: CombatState;
  audioState: AudioState;
  tokens: Token[];
  activeMapId: string | null;
  sharedMap: SharedMap | null;
  playerPins: Record<string, PlayerPin>;
}

export interface SessionState {
  role: SessionRole;
  hostPeerId: string | null;
  myPeerId: string | null;
  myCharacterId: string | null;
  myCharacter: AssignedCharacter | null;
  myPlayerName: string;
  peers: PeerInfo[];
  assignedCharacters: Record<string, AssignedCharacter>;
  combat: CombatState;
  audioState: AudioState;
  tokens: Token[];
  activeMapId: string | null;
  sharedMap: SharedMap | null;
  playerPins: Record<string, PlayerPin>;
  log: LogEntry[];
}

export const INITIAL_SESSION_STATE: SessionState = {
  role: 'offline',
  hostPeerId: null,
  myPeerId: null,
  myCharacterId: null,
  myCharacter: null,
  myPlayerName: '',
  peers: [],
  assignedCharacters: {},
  combat: { active: false, round: 0, currentTurnIndex: 0, entries: [] },
  audioState: { active: {} },
  tokens: [],
  activeMapId: null,
  sharedMap: null,
  playerPins: {},
  log: [],
};
