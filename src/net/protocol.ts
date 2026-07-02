import type { SessionSnapshot, PeerInfo, InitiativeEntry, PlayerPin, SharedMap } from '../types/session';
import type { BattleMapRecord } from '../types/map';

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
  // AUDIO_CUE: cue leve (Jeito 1). sources: URLs para faixas bundled (guest pode tocar via URL); omitir para faixas IDB (guest carrega do seu IDB local)
  | { type: 'AUDIO_CUE'; trackId: string; action: 'play' | 'stop' | 'volume'; volume?: number; loop?: boolean; sources?: string[] }
  // Distribuição de asset importado (Opção A — chunking ~64 KB base64)
  | { type: 'AUDIO_ASSET_BEGIN'; assetId: string; label: string; kind: 'ambient' | 'sfx'; mime: string; totalBytes: number; totalChunks: number }
  | { type: 'AUDIO_ASSET_CHUNK'; assetId: string; index: number; data: string /* base64 */ }
  | { type: 'AUDIO_ASSET_END'; assetId: string }
  | { type: 'AUDIO_ASSET_ACK'; assetId: string; received: number /* chunks confirmados */ }
  | { type: 'TOKEN_MOVE'; tokenId: string; x: number; y: number }
  | { type: 'FOG_UPDATE'; revealed: Array<{ x: number; y: number }> }
  | { type: 'COMBAT_START'; entries: InitiativeEntry[] }
  | { type: 'COMBAT_END' }
  | { type: 'TURN_ADVANCE'; currentTurnIndex: number; round: number }
  | { type: 'CHAT_MESSAGE'; peerId: string; playerName: string; text: string }
  // Mapa do Mundo — compartilhamento com guests (Fase 4.5)
  | { type: 'MAP_SHARE'; sharedMap: SharedMap }
  | { type: 'MAP_IMAGE_BEGIN'; imageRefId: string; mime: string; totalBytes: number; totalChunks: number }
  | { type: 'MAP_IMAGE_CHUNK'; imageRefId: string; index: number; data: string /* base64 */ }
  | { type: 'MAP_IMAGE_END'; imageRefId: string }
  | { type: 'MAP_IMAGE_ACK'; imageRefId: string }
  // Pins dos jogadores (posição livre no mapa, efêmera, não persiste no AppState)
  | { type: 'PLAYER_PIN_UPDATE'; pin: PlayerPin }
  | { type: 'PLAYER_PIN_CLEAR'; peerId: string }
  // Grid de batalha (Fase 9) — estado completo do mapa ativo (null = grid desativado).
  // TOKEN_MOVE e FOG_UPDATE (acima) fazem as atualizações leves; imagem viaja via MAP_IMAGE_*
  | { type: 'BATTLE_MAP_SHARE'; battle: BattleMapRecord | null };
