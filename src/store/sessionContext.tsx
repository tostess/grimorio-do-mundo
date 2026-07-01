import {
  createContext, useContext, useReducer, useRef, useCallback, useEffect, useState,
  type ReactNode,
} from 'react';
import type {
  SessionState, SessionRole, PeerInfo, SessionSnapshot, LogEntry,
  CombatState, InitiativeEntry, AssignedCharacter, PlayerPin, SharedMap,
} from '../types/session';
import type { SessionMessage } from '../net/protocol';
import { SessionHost } from '../net/SessionHost';
import { SessionGuest } from '../net/SessionGuest';
import { generateShortCode } from '../net/qr';
import { INITIAL_SESSION_STATE } from '../types/session';
import { audioManager, type PlayOptions } from '../utils/audio';
import { addAudioDB, type AudioMeta } from '../utils/audioStorage';
import { addMapImageDB } from '../utils/mapStorage';

// Paleta de cores por slot de jogador (até 6)
const PIN_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#a8dadc'];

// ── Dice parser ───────────────────────────────────────────────────────────────

export interface DiceResult {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
  breakdown: string;
}

export function parseDiceRoll(notation: string): DiceResult | null {
  const m = notation.trim().toLowerCase().match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;

  const count = Math.min(parseInt(m[1] || '1', 10), 100);
  const sides = parseInt(m[2], 10);
  const modifier = parseInt(m[3] ?? '0', 10);

  if (count < 1 || sides < 2 || sides > 10000) return null;

  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;
  const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
  const rollsStr = count > 1 ? `[${rolls.join(', ')}]` : `${rolls[0]}`;
  const breakdown = count > 1 || modifier !== 0 ? `${rollsStr}${modStr} = ${total}` : `${rolls[0]}`;

  return { notation: notation.trim().toLowerCase(), rolls, modifier, total, breakdown };
}

// ── Base64 helper (guest-side: reconstruct ArrayBuffer from chunks) ──────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type SessionAction =
  | { type: 'OPEN'; code: string }
  | { type: 'JOIN'; hostPeerId: string; myPeerId: string; playerName: string }
  | { type: 'SET_MY_PEER_ID'; peerId: string }
  | { type: 'SET_PEERS'; peers: PeerInfo[] }
  | { type: 'APPLY_SNAPSHOT'; snapshot: SessionSnapshot }
  | { type: 'ASSIGN_CHARACTER'; peerId: string; characterId: string | null; character: AssignedCharacter | null }
  | { type: 'ADD_LOG'; entry: LogEntry }
  | { type: 'SET_ROLE'; role: SessionRole }
  | { type: 'SET_COMBAT'; combat: CombatState }
  | { type: 'UPDATE_ENTRY'; entryId: string; patch: Partial<InitiativeEntry> }
  | { type: 'ADVANCE_TURN'; currentTurnIndex: number; round: number }
  | { type: 'SET_AUDIO_TRACK'; trackId: string; state: { playing: boolean; volume: number; loop: boolean } }
  | { type: 'CLEAR_AUDIO_TRACK'; trackId: string }
  | { type: 'SET_SHARED_MAP'; sharedMap: SharedMap | null }
  | { type: 'SET_PLAYER_PIN'; pin: PlayerPin }
  | { type: 'CLEAR_PLAYER_PIN'; peerId: string }
  | { type: 'RESET' };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'OPEN':
      return { ...INITIAL_SESSION_STATE, role: 'host', myPeerId: action.code, hostPeerId: action.code };
    case 'JOIN':
      return {
        ...INITIAL_SESSION_STATE,
        role: 'guest',
        hostPeerId: action.hostPeerId,
        myPeerId: action.myPeerId,
        myPlayerName: action.playerName,
      };
    case 'SET_MY_PEER_ID':
      return { ...state, myPeerId: action.peerId };
    case 'SET_PEERS':
      return { ...state, peers: action.peers };
    case 'APPLY_SNAPSHOT': {
      const myPeerId = state.myPeerId;
      const myPeer = myPeerId ? action.snapshot.peers.find(p => p.peerId === myPeerId) : undefined;
      return {
        ...state,
        ...action.snapshot,
        myCharacterId: myPeer?.characterId ?? state.myCharacterId,
        myCharacter: myPeerId ? action.snapshot.assignedCharacters[myPeerId] ?? null : state.myCharacter,
      };
    }
    case 'ASSIGN_CHARACTER': {
      const assignedCharacters = { ...state.assignedCharacters };
      if (action.character) assignedCharacters[action.peerId] = action.character;
      else delete assignedCharacters[action.peerId];
      const peers = state.peers.map(p =>
        p.peerId === action.peerId ? { ...p, characterId: action.characterId } : p,
      );
      return {
        ...state,
        peers,
        assignedCharacters,
        myCharacterId: action.peerId === state.myPeerId ? action.characterId : state.myCharacterId,
        myCharacter: action.peerId === state.myPeerId ? action.character : state.myCharacter,
      };
    }
    case 'ADD_LOG':
      return { ...state, log: [action.entry, ...state.log].slice(0, 200) };
    case 'SET_ROLE':
      return { ...state, role: action.role };
    case 'SET_COMBAT':
      return { ...state, combat: action.combat };
    case 'UPDATE_ENTRY': {
      const entries = state.combat.entries.map(e =>
        e.id === action.entryId ? { ...e, ...action.patch } : e,
      );
      const updatedEntry = entries.find(e => e.id === action.entryId);
      if (!updatedEntry?.characterId) {
        return { ...state, combat: { ...state.combat, entries } };
      }
      const assignedCharacters = { ...state.assignedCharacters };
      for (const [peerId, char] of Object.entries(assignedCharacters)) {
        if (char.id === updatedEntry.characterId) {
          assignedCharacters[peerId] = {
            ...char,
            hpCurrent: updatedEntry.hp,
            hpMax: updatedEntry.hpMax,
            armorClass: updatedEntry.ac,
            conditions: updatedEntry.conditions,
          };
        }
      }
      const myCharacter = state.myCharacter?.id === updatedEntry.characterId
        ? {
            ...state.myCharacter,
            hpCurrent: updatedEntry.hp,
            hpMax: updatedEntry.hpMax,
            armorClass: updatedEntry.ac,
            conditions: updatedEntry.conditions,
          }
        : state.myCharacter;
      return { ...state, assignedCharacters, myCharacter, combat: { ...state.combat, entries } };
    }
    case 'ADVANCE_TURN':
      return { ...state, combat: { ...state.combat, currentTurnIndex: action.currentTurnIndex, round: action.round } };
    case 'SET_AUDIO_TRACK':
      return {
        ...state,
        audioState: { active: { ...state.audioState.active, [action.trackId]: action.state } },
      };
    case 'CLEAR_AUDIO_TRACK': {
      const active = { ...state.audioState.active };
      delete active[action.trackId];
      return { ...state, audioState: { active } };
    }
    case 'SET_SHARED_MAP':
      return { ...state, sharedMap: action.sharedMap };
    case 'SET_PLAYER_PIN':
      return { ...state, playerPins: { ...state.playerPins, [action.pin.peerId]: action.pin } };
    case 'CLEAR_PLAYER_PIN': {
      const pins = { ...state.playerPins };
      delete pins[action.peerId];
      return { ...state, playerPins: pins };
    }
    case 'RESET':
      return INITIAL_SESSION_STATE;
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface SessionContextType {
  session: SessionState;
  audioAssetsVersion: number;
  audioTransferProgress: Record<string, Record<string, number>>;
  mapTransferProgress: Record<string, number>;
  openSession: () => string;
  joinSession: (hostId: string, playerName: string) => void;
  closeSession: () => void;
  sendMessage: (msg: SessionMessage) => void;
  broadcastFromHost: (msg: SessionMessage, excludePeer?: string) => void;
  rollDice: (notation: string) => DiceResult | null;
  // Combat (host only)
  startCombat: (entries: InitiativeEntry[]) => void;
  endCombat: () => void;
  advanceTurn: () => void;
  applyHp: (entryId: string, hp: number) => void;
  applyConditions: (entryId: string, conditions: string[]) => void;
  assignCharacter: (peerId: string, characterId: string | null, character: AssignedCharacter | null) => void;
  // Mapa (host only)
  shareMap: (sharedMap: SharedMap, imageBuffer: ArrayBuffer, mime: string) => Promise<void>;
  // Pins (host e guest)
  updateMyPin: (x: number, y: number) => void;
  clearMyPin: () => void;
  // Audio
  playAudioTrack: (trackId: string, options?: PlayOptions) => Promise<void>;
  stopAudioTrack: (trackId: string) => void;
  setAudioVolume: (trackId: string, volume: number) => void;
  crossfadeAudio: (fromId: string, toId: string, durationMs: number, toOptions?: PlayOptions) => Promise<void>;
  pushAudioAsset: (assetId: string, meta: { label: string; kind: 'ambient' | 'sfx'; mime: string }, buffer: ArrayBuffer, peerIds?: string[]) => Promise<void>;
  unlockAudio: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

// Pending transfer state para guest reconstruir chunks antes de gravar no IDB
interface PendingTransfer {
  label: string;
  kind: 'ambient' | 'sfx';
  mime: string;
  chunks: Map<number, string>;
  totalChunks: number;
  totalBytes: number;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(sessionReducer, INITIAL_SESSION_STATE);
  const [audioAssetsVersion, setAudioAssetsVersion] = useState(0);
  const [audioTransferProgress, setAudioTransferProgress] = useState<Record<string, Record<string, number>>>({});
  const [mapTransferProgress, setMapTransferProgress] = useState<Record<string, number>>({});
  const hostRef = useRef<SessionHost | null>(null);
  const guestRef = useRef<SessionGuest | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pendingTransfersRef = useRef<Map<string, PendingTransfer>>(new Map());
  const pendingMapChunksRef = useRef<Map<string, { chunks: Map<number, string>; totalChunks: number; mime: string }>>(new Map());

  const _addLog = useCallback((
    peerId: string,
    playerName: string,
    type: LogEntry['type'],
    text: string,
    extra?: Partial<LogEntry>,
  ) => {
    dispatch({
      type: 'ADD_LOG',
      entry: {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        peerId,
        playerName,
        type,
        text,
        ...extra,
      },
    });
  }, []);

  const openSession = useCallback((): string => {
    hostRef.current?.destroy();
    guestRef.current?.destroy();
    hostRef.current = null;
    guestRef.current = null;

    const code = generateShortCode();
    const emptySnapshot: SessionSnapshot = {
      peers: [],
      assignedCharacters: {},
      combat: { active: false, round: 0, currentTurnIndex: 0, entries: [] },
      audioState: { active: {} },
      tokens: [],
      activeMapId: null,
      sharedMap: null,
      playerPins: {},
    };

    hostRef.current = new SessionHost(
      code,
      emptySnapshot,
      peers => dispatch({ type: 'SET_PEERS', peers }),
      (from, msg) => {
        if (msg.type === 'DICE_ROLL' || msg.type === 'CHAT_MESSAGE') {
          hostRef.current?.broadcast(msg, from);
          _addLog(
            msg.peerId,
            msg.playerName,
            msg.type === 'DICE_ROLL' ? 'dice' : 'chat',
            msg.type === 'DICE_ROLL'
              ? `${msg.playerName} rolou ${msg.notation}: ${msg.total} (${msg.breakdown})`
              : `${msg.playerName}: ${msg.text}`,
          );
        }
        if (msg.type === 'AUDIO_ASSET_ACK') {
          setAudioTransferProgress(prev => {
            const assetProgress = prev[msg.assetId];
            if (!assetProgress) return prev;
            return { ...prev, [msg.assetId]: { ...assetProgress, [from]: 1 } };
          });
        }
        // Pin do jogador: host atualiza snapshot + broadcast para todos
        if (msg.type === 'PLAYER_PIN_UPDATE') {
          dispatch({ type: 'SET_PLAYER_PIN', pin: msg.pin });
          hostRef.current?.broadcast(msg, from);
          const snap = sessionRef.current;
          hostRef.current?.updateSnapshot({
            ...snap, playerPins: { ...snap.playerPins, [msg.pin.peerId]: msg.pin },
          } as SessionSnapshot);
        }
        if (msg.type === 'PLAYER_PIN_CLEAR') {
          dispatch({ type: 'CLEAR_PLAYER_PIN', peerId: msg.peerId });
          hostRef.current?.broadcast(msg, from);
          const snap = { ...sessionRef.current } as SessionSnapshot;
          const pins = { ...snap.playerPins };
          delete pins[msg.peerId];
          hostRef.current?.updateSnapshot({ ...snap, playerPins: pins });
        }
        if (msg.type === 'MAP_IMAGE_ACK') {
          setMapTransferProgress(prev => {
            const next = { ...prev };
            delete next[msg.imageRefId];
            return next;
          });
        }
      },
    );

    dispatch({ type: 'OPEN', code });
    _addLog('host', 'Sistema', 'system', `Sessão aberta com código: ${code}`);
    return code;
  }, [_addLog]);

  const joinSession = useCallback((hostId: string, playerName: string) => {
    hostRef.current?.destroy();
    guestRef.current?.destroy();
    hostRef.current = null;
    guestRef.current = null;

    // Persist host+name so the page refresh can auto-reconnect
    sessionStorage.setItem('grimorio_join_host', hostId);
    sessionStorage.setItem('grimorio_join_name', playerName);

    const guest = new SessionGuest(hostId, playerName, null, {
      onPeerIdReady: peerId => {
        dispatch({ type: 'JOIN', hostPeerId: hostId, myPeerId: peerId, playerName });
      },
      onAccepted: snapshot => {
        dispatch({ type: 'APPLY_SNAPSHOT', snapshot });
        _addLog('system', 'Sistema', 'system', `Conectado à sessão do mestre.`);
        // Carrega cache de metadados do IDB para o AudioManager
        audioManager.refreshMeta().catch(() => { /* non-fatal */ });
      },
      onRejected: reason => {
        const msg = reason === 'full' ? 'Sessão lotada (máx. 6 jogadores).' : `Rejeitado: ${reason}`;
        _addLog('system', 'Sistema', 'system', msg);
        guestRef.current?.destroy();
        guestRef.current = null;
        dispatch({ type: 'RESET' });
      },
      onSync: snapshot => dispatch({ type: 'APPLY_SNAPSHOT', snapshot }),
      onMessage: msg => {
        if (msg.type === 'PEER_JOINED') {
          _addLog('system', 'Sistema', 'system', `${msg.peer.playerName} entrou na sessão.`);
        } else if (msg.type === 'PEER_LEFT') {
          _addLog('system', 'Sistema', 'system', `Um jogador saiu da sessão.`);
        } else if (msg.type === 'DICE_ROLL') {
          _addLog(
            msg.peerId, msg.playerName, 'dice',
            `${msg.playerName} rolou ${msg.notation}: ${msg.total} (${msg.breakdown})`,
          );
        } else if (msg.type === 'CHAT_MESSAGE') {
          _addLog(msg.peerId, msg.playerName, 'chat', `${msg.playerName}: ${msg.text}`);
        } else if (msg.type === 'ASSIGN_CHARACTER') {
          dispatch({
            type: 'ASSIGN_CHARACTER',
            peerId: msg.peerId,
            characterId: msg.characterId,
            character: msg.character,
          });
          if (msg.peerId === sessionRef.current.myPeerId) {
            _addLog(
              'system',
              'Sistema',
              'system',
              msg.character ? `Ficha atribuida: ${msg.character.name}.` : 'Sua ficha foi desvinculada.',
            );
          }
        } else if (msg.type === 'COMBAT_START') {
          dispatch({ type: 'SET_COMBAT', combat: { active: true, round: 1, currentTurnIndex: 0, entries: msg.entries } });
          _addLog('system', 'Sistema', 'system', 'Combate iniciado!');
        } else if (msg.type === 'COMBAT_END') {
          dispatch({ type: 'SET_COMBAT', combat: INITIAL_SESSION_STATE.combat });
          _addLog('system', 'Sistema', 'system', 'Combate encerrado.');
        } else if (msg.type === 'TURN_ADVANCE') {
          dispatch({ type: 'ADVANCE_TURN', currentTurnIndex: msg.currentTurnIndex, round: msg.round });
        } else if (msg.type === 'HP_UPDATE') {
          dispatch({ type: 'UPDATE_ENTRY', entryId: msg.targetId, patch: { hp: msg.hp } });
        } else if (msg.type === 'CONDITION_CHANGE') {
          dispatch({ type: 'UPDATE_ENTRY', entryId: msg.targetId, patch: { conditions: msg.conditions } });
        } else if (msg.type === 'AUDIO_CUE') {
          // EXPERIMENTAL: áudio nos guests pode falhar silenciosamente
          void (async () => {
            try {
              if (msg.action === 'play') {
                await audioManager.play(msg.trackId, {
                  sources: msg.sources,
                  loop: msg.loop ?? true,
                  volume: msg.volume ?? 0.8,
                });
                dispatch({
                  type: 'SET_AUDIO_TRACK',
                  trackId: msg.trackId,
                  state: { playing: true, volume: msg.volume ?? 0.8, loop: msg.loop ?? true },
                });
              } else if (msg.action === 'stop') {
                audioManager.stop(msg.trackId);
                dispatch({ type: 'CLEAR_AUDIO_TRACK', trackId: msg.trackId });
              } else if (msg.action === 'volume') {
                audioManager.setVolume(msg.trackId, msg.volume ?? 0.8);
              }
            } catch {
              // falha silenciosa — não interrompe a sessão do guest
            }
          })();
        } else if (msg.type === 'AUDIO_ASSET_BEGIN') {
          pendingTransfersRef.current.set(msg.assetId, {
            label: msg.label,
            kind: msg.kind,
            mime: msg.mime,
            chunks: new Map(),
            totalChunks: msg.totalChunks,
            totalBytes: msg.totalBytes,
          });
        } else if (msg.type === 'AUDIO_ASSET_CHUNK') {
          const transfer = pendingTransfersRef.current.get(msg.assetId);
          if (transfer) transfer.chunks.set(msg.index, msg.data);
        } else if (msg.type === 'AUDIO_ASSET_END') {
          void (async () => {
            const transfer = pendingTransfersRef.current.get(msg.assetId);
            if (!transfer) return;

            // Monta ArrayBuffer a partir dos chunks base64
            const parts: ArrayBuffer[] = [];
            for (let i = 0; i < transfer.totalChunks; i++) {
              const chunk = transfer.chunks.get(i);
              if (chunk) parts.push(base64ToArrayBuffer(chunk));
            }
            const totalLen = parts.reduce((acc, p) => acc + p.byteLength, 0);
            const result = new Uint8Array(totalLen);
            let offset = 0;
            for (const part of parts) {
              result.set(new Uint8Array(part), offset);
              offset += part.byteLength;
            }

            const meta: AudioMeta = {
              id: msg.assetId,
              label: transfer.label,
              kind: transfer.kind,
              mime: transfer.mime,
              origin: 'received',
              createdAt: new Date().toISOString(),
            };

            try {
              await addAudioDB(meta, result.buffer);
              await audioManager.refreshMeta();
              setAudioAssetsVersion(v => v + 1);
              _addLog('system', 'Sistema', 'system', `Faixa de áudio recebida: ${transfer.label}`);
            } catch (err) {
              console.warn('[Audio] failed to store received asset:', err);
            }

            pendingTransfersRef.current.delete(msg.assetId);
            guestRef.current?.send({ type: 'AUDIO_ASSET_ACK', assetId: msg.assetId, received: transfer.totalChunks });
          })();
        } else if (msg.type === 'MAP_SHARE') {
          dispatch({ type: 'SET_SHARED_MAP', sharedMap: msg.sharedMap });
          _addLog('system', 'Sistema', 'system', 'Mestre compartilhou o mapa da sessão.');
        } else if (msg.type === 'MAP_IMAGE_BEGIN') {
          pendingMapChunksRef.current.set(msg.imageRefId, {
            chunks: new Map(),
            totalChunks: msg.totalChunks,
            mime: msg.mime,
          });
        } else if (msg.type === 'MAP_IMAGE_CHUNK') {
          const transfer = pendingMapChunksRef.current.get(msg.imageRefId);
          if (transfer) transfer.chunks.set(msg.index, msg.data);
        } else if (msg.type === 'MAP_IMAGE_END') {
          void (async () => {
            const transfer = pendingMapChunksRef.current.get(msg.imageRefId);
            if (!transfer) return;
            const parts: ArrayBuffer[] = [];
            for (let i = 0; i < transfer.totalChunks; i++) {
              const chunk = transfer.chunks.get(i);
              if (chunk) parts.push(base64ToArrayBuffer(chunk));
            }
            const totalLen = parts.reduce((acc, p) => acc + p.byteLength, 0);
            const result = new Uint8Array(totalLen);
            let offset = 0;
            for (const part of parts) { result.set(new Uint8Array(part), offset); offset += part.byteLength; }
            const sharedMap = sessionRef.current.sharedMap;
            try {
              await addMapImageDB(
                { id: msg.imageRefId, name: 'mapa-sessao', mime: transfer.mime, width: sharedMap?.width ?? 0, height: sharedMap?.height ?? 0, createdAt: new Date().toISOString() },
                result.buffer,
              );
              _addLog('system', 'Sistema', 'system', 'Imagem do mapa recebida e pronta para visualização.');
            } catch (err) { console.warn('[Map] falha ao salvar imagem recebida:', err); }
            pendingMapChunksRef.current.delete(msg.imageRefId);
            guestRef.current?.send({ type: 'MAP_IMAGE_ACK', imageRefId: msg.imageRefId });
          })();
        } else if (msg.type === 'PLAYER_PIN_UPDATE') {
          dispatch({ type: 'SET_PLAYER_PIN', pin: msg.pin });
        } else if (msg.type === 'PLAYER_PIN_CLEAR') {
          dispatch({ type: 'CLEAR_PLAYER_PIN', peerId: msg.peerId });
        }
      },
      onDisconnect: () => {
        sessionStorage.removeItem('grimorio_join_host');
        sessionStorage.removeItem('grimorio_join_name');
        _addLog('system', 'Sistema', 'system', 'Desconectado do mestre.');
        audioManager.stopAll();
        dispatch({ type: 'RESET' });
      },
    });

    guestRef.current = guest;
  }, [_addLog]);

  const closeSession = useCallback(() => {
    sessionStorage.removeItem('grimorio_join_host');
    sessionStorage.removeItem('grimorio_join_name');
    audioManager.stopAll();
    hostRef.current?.destroy();
    guestRef.current?.destroy();
    hostRef.current = null;
    guestRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const sendMessage = useCallback((msg: SessionMessage) => {
    guestRef.current?.send(msg);
  }, []);

  const broadcastFromHost = useCallback((msg: SessionMessage, excludePeer?: string) => {
    hostRef.current?.broadcast(msg, excludePeer);
  }, []);

  const rollDice = useCallback((notation: string): DiceResult | null => {
    const result = parseDiceRoll(notation);
    if (!result) return null;

    const cur = sessionRef.current;
    const peerId = cur.myPeerId ?? 'host';
    const playerName = cur.role === 'host' ? 'Mestre' : cur.myPlayerName;

    const msg: SessionMessage = {
      type: 'DICE_ROLL',
      peerId,
      playerName,
      notation: result.notation,
      total: result.total,
      rolls: result.rolls,
      breakdown: result.breakdown,
    };

    const logText = `${playerName} rolou ${result.notation}: **${result.total}** (${result.breakdown})`;

    if (cur.role === 'host') {
      _addLog(peerId, playerName, 'dice', logText);
      hostRef.current?.broadcast(msg);
    } else if (cur.role === 'guest') {
      _addLog(peerId, playerName, 'dice', logText);
      guestRef.current?.send(msg);
    }

    return result;
  }, [_addLog]);

  // ── Combat helpers (host only) ──────────────────────────────────────────────

  const _getSnapshot = useCallback((): SessionSnapshot => {
    const { peers, assignedCharacters, combat, audioState, tokens, activeMapId, sharedMap, playerPins } = sessionRef.current;
    return { peers, assignedCharacters, combat, audioState, tokens, activeMapId, sharedMap, playerPins };
  }, []);

  const startCombat = useCallback((entries: InitiativeEntry[]) => {
    const sorted = [...entries].sort((a, b) => b.initiative - a.initiative);
    const combat: CombatState = { active: true, round: 1, currentTurnIndex: 0, entries: sorted };
    dispatch({ type: 'SET_COMBAT', combat });
    const msg: SessionMessage = { type: 'COMBAT_START', entries: sorted };
    hostRef.current?.broadcast(msg);
    hostRef.current?.updateSnapshot({ ..._getSnapshot(), combat });
    _addLog('system', 'Sistema', 'system', `Combate iniciado! ${sorted.length} participantes.`);
  }, [_addLog, _getSnapshot]);

  const endCombat = useCallback(() => {
    const combat = INITIAL_SESSION_STATE.combat;
    dispatch({ type: 'SET_COMBAT', combat });
    hostRef.current?.broadcast({ type: 'COMBAT_END' });
    hostRef.current?.updateSnapshot({ ..._getSnapshot(), combat });
    _addLog('system', 'Sistema', 'system', 'Combate encerrado.');
  }, [_addLog, _getSnapshot]);

  const advanceTurn = useCallback(() => {
    const { entries, currentTurnIndex, round } = sessionRef.current.combat;
    if (!entries.length) return;
    const nextIndex = (currentTurnIndex + 1) % entries.length;
    const nextRound = nextIndex === 0 ? round + 1 : round;
    dispatch({ type: 'ADVANCE_TURN', currentTurnIndex: nextIndex, round: nextRound });
    const msg: SessionMessage = { type: 'TURN_ADVANCE', currentTurnIndex: nextIndex, round: nextRound };
    hostRef.current?.broadcast(msg);
    hostRef.current?.updateSnapshot({
      ..._getSnapshot(),
      combat: { ...sessionRef.current.combat, currentTurnIndex: nextIndex, round: nextRound },
    });
    const nextName = entries[nextIndex]?.name ?? '';
    _addLog('system', 'Sistema', 'system',
      nextIndex === 0
        ? `Round ${nextRound} — turno de ${nextName}`
        : `Turno de ${nextName}`,
    );
  }, [_addLog, _getSnapshot]);

  const applyHp = useCallback((entryId: string, hp: number) => {
    dispatch({ type: 'UPDATE_ENTRY', entryId, patch: { hp } });
    hostRef.current?.broadcast({ type: 'HP_UPDATE', targetId: entryId, hp });
    const combat = {
      ...sessionRef.current.combat,
      entries: sessionRef.current.combat.entries.map(e => e.id === entryId ? { ...e, hp } : e),
    };
    hostRef.current?.updateSnapshot({ ..._getSnapshot(), combat });
  }, [_getSnapshot]);

  const applyConditions = useCallback((entryId: string, conditions: string[]) => {
    dispatch({ type: 'UPDATE_ENTRY', entryId, patch: { conditions } });
    hostRef.current?.broadcast({ type: 'CONDITION_CHANGE', targetId: entryId, conditions });
    const combat = {
      ...sessionRef.current.combat,
      entries: sessionRef.current.combat.entries.map(e => e.id === entryId ? { ...e, conditions } : e),
    };
    hostRef.current?.updateSnapshot({ ..._getSnapshot(), combat });
  }, [_getSnapshot]);

  const assignCharacter = useCallback((
    peerId: string,
    characterId: string | null,
    character: AssignedCharacter | null,
  ) => {
    hostRef.current?.assignCharacter(peerId, characterId);
    dispatch({ type: 'ASSIGN_CHARACTER', peerId, characterId, character });
    const nextSnapshot = _getSnapshot();
    nextSnapshot.peers = nextSnapshot.peers.map(p =>
      p.peerId === peerId ? { ...p, characterId } : p,
    );
    nextSnapshot.assignedCharacters = { ...nextSnapshot.assignedCharacters };
    if (character) nextSnapshot.assignedCharacters[peerId] = character;
    else delete nextSnapshot.assignedCharacters[peerId];
    hostRef.current?.updateSnapshot(nextSnapshot);
    hostRef.current?.broadcast({ type: 'ASSIGN_CHARACTER', peerId, characterId, character });
    _addLog(
      'system',
      'Sistema',
      'system',
      character ? `${character.name} vinculada a um jogador.` : 'Ficha desvinculada de um jogador.',
    );
  }, [_addLog, _getSnapshot]);

  // ── Map helpers ─────────────────────────────────────────────────────────────

  const shareMap = useCallback(async (sharedMap: SharedMap, imageBuffer: ArrayBuffer, mime: string): Promise<void> => {
    if (!hostRef.current) return;
    dispatch({ type: 'SET_SHARED_MAP', sharedMap });
    hostRef.current.broadcast({ type: 'MAP_SHARE', sharedMap } satisfies SessionMessage);
    hostRef.current.updateSnapshot({ ..._getSnapshot(), sharedMap });

    const targets = sessionRef.current.peers.filter(p => p.connected).map(p => p.peerId);
    if (targets.length === 0) return;

    const initial: Record<string, number> = {};
    for (const pid of targets) initial[pid] = 0;
    setMapTransferProgress(initial);

    await hostRef.current.pushMapImage(
      sharedMap.imageRefId,
      mime,
      imageBuffer,
      (peerId, sent, total) => {
        setMapTransferProgress(prev => ({ ...prev, [peerId]: sent / total }));
      },
      targets,
    );

    setTimeout(() => setMapTransferProgress({}), 3000);
    _addLog('system', 'Sistema', 'system', 'Mapa compartilhado com os jogadores.');
  }, [_addLog, _getSnapshot]);

  const updateMyPin = useCallback((x: number, y: number): void => {
    const cur = sessionRef.current;
    const peerId = cur.myPeerId ?? 'host';
    const playerName = cur.role === 'host' ? 'Mestre' : cur.myPlayerName;
    // Cor baseada no índice do peer na lista (ou índice 0 para host)
    const peerIdx = cur.peers.findIndex(p => p.peerId === peerId);
    const color = cur.role === 'host' ? '#c9a84c' : PIN_COLORS[peerIdx >= 0 ? peerIdx % PIN_COLORS.length : 0];
    const pin: PlayerPin = { peerId, playerName, color, x, y };

    dispatch({ type: 'SET_PLAYER_PIN', pin });

    const msg: SessionMessage = { type: 'PLAYER_PIN_UPDATE', pin };
    if (cur.role === 'host') {
      hostRef.current?.broadcast(msg);
      hostRef.current?.updateSnapshot({ ..._getSnapshot(), playerPins: { ...cur.playerPins, [peerId]: pin } });
    } else {
      guestRef.current?.send(msg);
    }
  }, [_getSnapshot]);

  const clearMyPin = useCallback((): void => {
    const cur = sessionRef.current;
    const peerId = cur.myPeerId ?? 'host';
    dispatch({ type: 'CLEAR_PLAYER_PIN', peerId });
    const msg: SessionMessage = { type: 'PLAYER_PIN_CLEAR', peerId };
    if (cur.role === 'host') {
      hostRef.current?.broadcast(msg);
      const pins = { ...cur.playerPins };
      delete pins[peerId];
      hostRef.current?.updateSnapshot({ ..._getSnapshot(), playerPins: pins });
    } else {
      guestRef.current?.send(msg);
    }
  }, [_getSnapshot]);

  // ── Audio helpers ───────────────────────────────────────────────────────────

  const playAudioTrack = useCallback(async (trackId: string, options: PlayOptions = {}): Promise<void> => {
    try {
      await audioManager.play(trackId, options);
    } catch (err) {
      console.warn('[Audio] play failed:', err);
      return;
    }
    const vol = options.volume ?? 0.8;
    const loop = options.loop ?? true;
    dispatch({ type: 'SET_AUDIO_TRACK', trackId, state: { playing: true, volume: vol, loop } });
    const cue: SessionMessage = {
      type: 'AUDIO_CUE', trackId, action: 'play', volume: vol, loop, sources: options.sources,
    };
    hostRef.current?.broadcast(cue);
    const snapshot = _getSnapshot();
    snapshot.audioState.active[trackId] = { playing: true, volume: vol, loop };
    hostRef.current?.updateSnapshot(snapshot);
  }, [_getSnapshot]);

  const stopAudioTrack = useCallback((trackId: string): void => {
    audioManager.stop(trackId);
    dispatch({ type: 'CLEAR_AUDIO_TRACK', trackId });
    hostRef.current?.broadcast({ type: 'AUDIO_CUE', trackId, action: 'stop' });
    const snapshot = _getSnapshot();
    delete snapshot.audioState.active[trackId];
    hostRef.current?.updateSnapshot(snapshot);
  }, [_getSnapshot]);

  const setAudioVolume = useCallback((trackId: string, volume: number): void => {
    audioManager.setVolume(trackId, volume);
    dispatch({ type: 'SET_AUDIO_TRACK', trackId, state: { playing: true, volume, loop: true } });
    hostRef.current?.broadcast({ type: 'AUDIO_CUE', trackId, action: 'volume', volume });
  }, []);

  const crossfadeAudio = useCallback(async (
    fromId: string,
    toId: string,
    durationMs: number,
    toOptions: PlayOptions = {},
  ): Promise<void> => {
    try {
      await audioManager.crossfade(fromId, toId, durationMs, toOptions);
    } catch (err) {
      console.warn('[Audio] crossfade failed:', err);
      return;
    }
    const vol = toOptions.volume ?? 0.8;
    const loop = toOptions.loop ?? true;
    dispatch({ type: 'CLEAR_AUDIO_TRACK', trackId: fromId });
    dispatch({ type: 'SET_AUDIO_TRACK', trackId: toId, state: { playing: true, volume: vol, loop } });
    hostRef.current?.broadcast({ type: 'AUDIO_CUE', trackId: fromId, action: 'stop' });
    hostRef.current?.broadcast({ type: 'AUDIO_CUE', trackId: toId, action: 'play', volume: vol, loop, sources: toOptions.sources });
    const snapshot = _getSnapshot();
    delete snapshot.audioState.active[fromId];
    snapshot.audioState.active[toId] = { playing: true, volume: vol, loop };
    hostRef.current?.updateSnapshot(snapshot);
  }, [_getSnapshot]);

  const pushAudioAsset = useCallback(async (
    assetId: string,
    meta: { label: string; kind: 'ambient' | 'sfx'; mime: string },
    buffer: ArrayBuffer,
    peerIds?: string[],
  ): Promise<void> => {
    if (!hostRef.current) return;
    const targets = peerIds ?? sessionRef.current.peers.filter(p => p.connected).map(p => p.peerId);
    if (targets.length === 0) return;

    // Inicializa progresso
    const initial: Record<string, number> = {};
    for (const pid of targets) initial[pid] = 0;
    setAudioTransferProgress(prev => ({ ...prev, [assetId]: initial }));

    await hostRef.current.pushAudioAsset(
      assetId,
      meta,
      buffer,
      (peerId, sent, total) => {
        setAudioTransferProgress(prev => ({
          ...prev,
          [assetId]: { ...(prev[assetId] ?? {}), [peerId]: sent / total },
        }));
      },
      targets,
    );

    // Limpa progresso após 3 s
    setTimeout(() => {
      setAudioTransferProgress(prev => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }, 3000);
  }, []);

  const unlockAudio = useCallback((): void => {
    audioManager.unlock();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioManager.stopAll();
      hostRef.current?.destroy();
      guestRef.current?.destroy();
    };
  }, []);

  return (
    <SessionContext.Provider value={{
      session,
      audioAssetsVersion,
      audioTransferProgress,
      mapTransferProgress,
      openSession,
      joinSession,
      closeSession,
      sendMessage,
      broadcastFromHost,
      rollDice,
      startCombat,
      endCombat,
      advanceTurn,
      applyHp,
      applyConditions,
      assignCharacter,
      shareMap,
      updateMyPin,
      clearMyPin,
      playAudioTrack,
      stopAudioTrack,
      setAudioVolume,
      crossfadeAudio,
      pushAudioAsset,
      unlockAudio,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionStore(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionStore must be used within SessionProvider');
  return ctx;
}
