import type { SessionSnapshot, PeerInfo, InitiativeEntry } from '../types/session';

export type SessionMessage =
  | { type: 'JOIN_REQUEST'; peerId: string; playerName: string; characterId: string | null }
  | { type: 'JOIN_ACCEPTED'; peerId: string; snapshot: SessionSnapshot }
  | { type: 'JOIN_REJECTED'; reason: 'full' | 'banned' }
  | { type: 'STATE_SYNC'; snapshot: SessionSnapshot }
  | { type: 'PEER_JOINED'; peer: PeerInfo }
  | { type: 'PEER_LEFT'; peerId: string }
  | { type: 'ASSIGN_CHARACTER'; peerId: string; characterId: string | null; character: SessionSnapshot['assignedCharacters'][string] | null }
  | { type: 'DICE_ROLL'; peerId: string; playerName: string; notation: string; total: number; rolls: number[]; breakdown: string }
  | { type: 'PLAYER_INTENT'; peerId: string; intent: { kind: string; payload: unknown } }
  | { type: 'INITIATIVE_UPDATE'; entries: InitiativeEntry[] }
  | { type: 'HP_UPDATE'; targetId: string; hp: number }
  | { type: 'CONDITION_CHANGE'; targetId: string; conditions: string[] }
  | { type: 'AUDIO_CUE'; trackId: string; action: 'play' | 'stop'; volume: number; loop: boolean }
  | { type: 'TOKEN_MOVE'; tokenId: string; x: number; y: number }
  | { type: 'FOG_UPDATE'; revealed: Array<{ x: number; y: number }> }
  | { type: 'COMBAT_START'; entries: InitiativeEntry[] }
  | { type: 'COMBAT_END' }
  | { type: 'TURN_ADVANCE'; currentTurnIndex: number; round: number }
  | { type: 'CHAT_MESSAGE'; peerId: string; playerName: string; text: string };
