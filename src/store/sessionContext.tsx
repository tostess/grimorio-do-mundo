import {
  createContext, useContext, useReducer, useRef, useCallback, useEffect, type ReactNode,
} from 'react';
import type {
  SessionState, SessionRole, PeerInfo, SessionSnapshot, LogEntry,
  CombatState, InitiativeEntry, AssignedCharacter,
} from '../types/session';
import type { SessionMessage } from '../net/protocol';
import { SessionHost } from '../net/SessionHost';
import { SessionGuest } from '../net/SessionGuest';
import { generateShortCode } from '../net/qr';
import { INITIAL_SESSION_STATE } from '../types/session';

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
    case 'RESET':
      return INITIAL_SESSION_STATE;
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface SessionContextType {
  session: SessionState;
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
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(sessionReducer, INITIAL_SESSION_STATE);
  const hostRef = useRef<SessionHost | null>(null);
  const guestRef = useRef<SessionGuest | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

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
    };

    hostRef.current = new SessionHost(
      code,
      emptySnapshot,
      peers => dispatch({ type: 'SET_PEERS', peers }),
      (from, msg) => {
        // Relay broadcast-worthy messages to all other guests
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

    const guest = new SessionGuest(hostId, playerName, null, {
      onPeerIdReady: peerId => {
        dispatch({ type: 'JOIN', hostPeerId: hostId, myPeerId: peerId, playerName });
      },
      onAccepted: snapshot => {
        dispatch({ type: 'APPLY_SNAPSHOT', snapshot });
        _addLog('system', 'Sistema', 'system', `Conectado à sessão do mestre.`);
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
        }
      },
      onDisconnect: () => {
        _addLog('system', 'Sistema', 'system', 'Desconectado do mestre.');
        dispatch({ type: 'RESET' });
      },
    });

    guestRef.current = guest;
  }, [_addLog]);

  const closeSession = useCallback(() => {
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
      // Host adds to own log and broadcasts to all guests
      _addLog(peerId, playerName, 'dice', logText);
      hostRef.current?.broadcast(msg);
    } else if (cur.role === 'guest') {
      // Guest adds to own log immediately (optimistic) and sends to host
      _addLog(peerId, playerName, 'dice', logText);
      guestRef.current?.send(msg);
    }

    return result;
  }, [_addLog]);

  // ── Combat helpers (host only) ──────────────────────────────────────────────

  const _getSnapshot = useCallback((): SessionSnapshot => {
    const { peers, assignedCharacters, combat, audioState, tokens, activeMapId } = sessionRef.current;
    return { peers, assignedCharacters, combat, audioState, tokens, activeMapId };
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

  // Cleanup on unmount (React StrictMode: both effects run, second cleanup calls destroy on the
  // already-destroyed peer — PeerJS handles this gracefully)
  useEffect(() => {
    return () => {
      hostRef.current?.destroy();
      guestRef.current?.destroy();
    };
  }, []);

  return (
    <SessionContext.Provider value={{
      session, openSession, joinSession, closeSession, sendMessage, broadcastFromHost, rollDice,
      startCombat, endCombat, advanceTurn, applyHp, applyConditions, assignCharacter,
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
