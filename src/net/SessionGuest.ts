import Peer from 'peerjs';
import type { SessionSnapshot } from '../types/session';
import type { SessionMessage } from './protocol';

export class SessionGuest {
  private peer: Peer;
  myPeerId: string = '';

  readonly hostId: string;
  readonly playerName: string;

  onAccepted: (snapshot: SessionSnapshot) => void;
  onRejected: (reason: string) => void;
  onSync: (snapshot: SessionSnapshot) => void;
  onMessage: (msg: SessionMessage) => void;
  onDisconnect: () => void;
  onPeerIdReady: (peerId: string) => void;

  constructor(
    hostId: string,
    playerName: string,
    characterId: string | null,
    callbacks: {
      onAccepted: (snapshot: SessionSnapshot) => void;
      onRejected: (reason: string) => void;
      onSync: (snapshot: SessionSnapshot) => void;
      onMessage: (msg: SessionMessage) => void;
      onDisconnect: () => void;
      onPeerIdReady: (peerId: string) => void;
    },
  ) {
    this.hostId = hostId;
    this.playerName = playerName;
    this.onAccepted = callbacks.onAccepted;
    this.onRejected = callbacks.onRejected;
    this.onSync = callbacks.onSync;
    this.onMessage = callbacks.onMessage;
    this.onDisconnect = callbacks.onDisconnect;
    this.onPeerIdReady = callbacks.onPeerIdReady;

    this.peer = new Peer();
    this.peer.on('open', id => {
      this.myPeerId = id;
      this.onPeerIdReady(id);

      const conn = this.peer.connect(hostId);

      conn.on('open', () => {
        conn.send({
          type: 'JOIN_REQUEST',
          peerId: id,
          playerName,
          characterId,
        } satisfies SessionMessage);
      });

      conn.on('data', (raw: unknown) => {
        const msg = raw as SessionMessage;
        if (msg.type === 'JOIN_ACCEPTED') {
          this.onAccepted(msg.snapshot);
        } else if (msg.type === 'JOIN_REJECTED') {
          this.onRejected(msg.reason);
          this.peer.destroy();
        } else if (msg.type === 'STATE_SYNC') {
          this.onSync(msg.snapshot);
        } else {
          this.onMessage(msg);
        }
      });

      conn.on('close', () => this.onDisconnect());
      conn.on('error', err => console.warn('[SessionGuest] conn error', err));
    });

    this.peer.on('error', err => console.error('[SessionGuest]', err));
  }

  send(msg: SessionMessage) {
    const allConns = this.peer.connections as Record<string, { send: (m: unknown) => void }[]>;
    const conns = allConns[this.hostId];
    if (conns?.length) conns[0].send(msg);
  }

  destroy() {
    this.peer.destroy();
  }
}
