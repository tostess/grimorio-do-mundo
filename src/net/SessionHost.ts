import Peer, { type DataConnection } from 'peerjs';
import type { PeerInfo, SessionSnapshot } from '../types/session';
import type { SessionMessage } from './protocol';

const MAX_PEERS = 6;

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
