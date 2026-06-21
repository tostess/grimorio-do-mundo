import Peer, { type DataConnection } from 'peerjs';
import type { PeerInfo, SessionSnapshot } from '../types/session';
import type { SessionMessage } from './protocol';

const MAX_PEERS = 6;
const CHUNK_SIZE = 64 * 1024; // 64 KB por chunk

function _toBase64Chunk(buffer: ArrayBuffer, start: number, end: number): string {
  const bytes = new Uint8Array(buffer, start, end - start);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class SessionHost {
  private peer: Peer;
  private connections = new Map<string, DataConnection>();
  private peerInfos = new Map<string, PeerInfo>();
  private _snapshot: SessionSnapshot;

  readonly code: string;
  onPeersChange: (peers: PeerInfo[]) => void;
  onGuestMessage: (from: string, msg: SessionMessage) => void;

  constructor(
    code: string,
    initialSnapshot: SessionSnapshot,
    onPeersChange: (peers: PeerInfo[]) => void,
    onGuestMessage: (from: string, msg: SessionMessage) => void,
  ) {
    this.code = code;
    this._snapshot = initialSnapshot;
    this.onPeersChange = onPeersChange;
    this.onGuestMessage = onGuestMessage;

    this.peer = new Peer(code);
    this.peer.on('connection', conn => this._accept(conn));
    this.peer.on('error', err => console.error('[SessionHost]', err));
  }

  private _accept(conn: DataConnection) {
    if (this.connections.size >= MAX_PEERS) {
      conn.on('open', () => {
        conn.send({ type: 'JOIN_REJECTED', reason: 'full' } satisfies SessionMessage);
        conn.close();
      });
      return;
    }

    conn.on('data', (raw: unknown) => {
      const msg = raw as SessionMessage;
      if (msg.type === 'JOIN_REQUEST') {
        const info: PeerInfo = {
          peerId: msg.peerId,
          playerName: msg.playerName,
          characterId: msg.characterId,
          connected: true,
        };
        this.connections.set(msg.peerId, conn);
        this.peerInfos.set(msg.peerId, info);

        const snapshot = this._currentSnapshot();
        conn.send({ type: 'JOIN_ACCEPTED', peerId: msg.peerId, snapshot } satisfies SessionMessage);
        this.broadcast({ type: 'PEER_JOINED', peer: info } satisfies SessionMessage, msg.peerId);
        this.onPeersChange([...this.peerInfos.values()]);
      } else {
        this.onGuestMessage(conn.peer, msg);
      }
    });

    conn.on('close', () => {
      const pid = conn.peer;
      this.connections.delete(pid);
      this.peerInfos.delete(pid);
      this.broadcast({ type: 'PEER_LEFT', peerId: pid } satisfies SessionMessage);
      this.onPeersChange([...this.peerInfos.values()]);
    });

    conn.on('error', err => console.warn('[SessionHost] conn error', err));
  }

  broadcast(msg: SessionMessage, excludePeerId?: string) {
    for (const [pid, conn] of this.connections) {
      if (pid !== excludePeerId && conn.open) {
        conn.send(msg);
      }
    }
  }

  sendTo(peerId: string, msg: SessionMessage) {
    const conn = this.connections.get(peerId);
    if (conn?.open) conn.send(msg);
  }

  assignCharacter(peerId: string, characterId: string | null) {
    const info = this.peerInfos.get(peerId);
    if (!info) return;
    this.peerInfos.set(peerId, { ...info, characterId });
    this.onPeersChange([...this.peerInfos.values()]);
  }

  updateSnapshot(snapshot: SessionSnapshot) {
    this._snapshot = snapshot;
  }

  syncAll() {
    const snapshot = this._currentSnapshot();
    this.broadcast({ type: 'STATE_SYNC', snapshot } satisfies SessionMessage);
  }

  // Distribui a imagem de um mapa para os peers via chunking base64 (~64 KB / chunk).
  async pushMapImage(
    imageRefId: string,
    mime: string,
    buffer: ArrayBuffer,
    onProgress?: (peerId: string, sent: number, total: number) => void,
    peerIds?: string[],
  ): Promise<void> {
    const totalBytes = buffer.byteLength;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    const targets = peerIds ?? [...this.connections.keys()];

    for (const peerId of targets) {
      const conn = this.connections.get(peerId);
      if (!conn?.open) continue;

      conn.send({ type: 'MAP_IMAGE_BEGIN', imageRefId, mime, totalBytes, totalChunks } satisfies SessionMessage);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const data = _toBase64Chunk(buffer, start, end);
        conn.send({ type: 'MAP_IMAGE_CHUNK', imageRefId, index: i, data } satisfies SessionMessage);
        onProgress?.(peerId, i + 1, totalChunks);
        await new Promise(r => setTimeout(r, 4));
      }

      conn.send({ type: 'MAP_IMAGE_END', imageRefId } satisfies SessionMessage);
    }
  }

  // Distribui um asset de áudio para os peers via chunking base64 (~64 KB / chunk).
  // onProgress é chamada após cada chunk enviado para um peer (sent / total).
  async pushAudioAsset(
    assetId: string,
    meta: { label: string; kind: 'ambient' | 'sfx'; mime: string },
    buffer: ArrayBuffer,
    onProgress: (peerId: string, sent: number, total: number) => void,
    peerIds?: string[],
  ): Promise<void> {
    const totalBytes = buffer.byteLength;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    const targets = peerIds ?? [...this.connections.keys()];

    for (const peerId of targets) {
      const conn = this.connections.get(peerId);
      if (!conn?.open) continue;

      conn.send({
        type: 'AUDIO_ASSET_BEGIN',
        assetId,
        label: meta.label,
        kind: meta.kind,
        mime: meta.mime,
        totalBytes,
        totalChunks,
      } satisfies SessionMessage);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalBytes);
        const data = _toBase64Chunk(buffer, start, end);
        conn.send({ type: 'AUDIO_ASSET_CHUNK', assetId, index: i, data } satisfies SessionMessage);
        onProgress(peerId, i + 1, totalChunks);
        // yield ao event loop para não saturar o data channel
        await new Promise(r => setTimeout(r, 4));
      }

      conn.send({ type: 'AUDIO_ASSET_END', assetId } satisfies SessionMessage);
    }
  }

  private _currentSnapshot(): SessionSnapshot {
    return {
      ...this._snapshot,
      peers: [...this.peerInfos.values()],
    };
  }

  destroy() {
    this.peer.destroy();
  }
}
