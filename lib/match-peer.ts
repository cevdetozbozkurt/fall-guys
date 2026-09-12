import Peer, { type DataConnection } from 'peerjs';

type Pending = {
  connection: DataConnection;
  messages: unknown[];
  capture: (data: unknown) => void;
};
// The queue owns one live network identity. Early arrivals are retained until
// the assigned host has received its match notification from the database.
export class MatchPeer {
  peer: Peer;
  pending: Pending[] = [];
  buffering = false;
  private capture = (connection: DataConnection) => {
    if (this.pending.length >= 5) {
      connection.close();
      return;
    }
    const item: Pending = {
      connection,
      messages: [],
      capture: (data) => {
        if (item.messages.length < 8) item.messages.push(data);
        else connection.close();
      },
    };
    connection.on('data', item.capture);
    this.pending.push(item);
  };
  constructor(peer: Peer) {
    this.peer = peer;
    this.resume();
  }
  resume() {
    if (!this.buffering && !this.peer.destroyed) {
      this.buffering = true;
      this.peer.on('connection', this.capture);
    }
  }
  take() {
    this.peer.off('connection', this.capture);
    this.buffering = false;
    const items = this.pending;
    this.pending = [];
    for (const item of items) item.connection.off('data', item.capture);
    return items;
  }
  destroy() {
    this.take().forEach((p) => p.connection.close());
    this.peer.destroy();
  }
}

export function createMatchPeer(): Promise<MatchPeer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(`tumble-public-${crypto.randomUUID()}`, { debug: 0 });
    const lease = new MatchPeer(peer);
    const timer = setTimeout(() => {
      lease.destroy();
      reject(
        new Error(
          'The game network could not connect. Check your connection and try again.',
        ),
      );
    }, 15000);
    peer.once('open', () => {
      clearTimeout(timer);
      resolve(lease);
    });
    peer.on('error', (error) => {
      if (!peer.open) {
        clearTimeout(timer);
        lease.destroy();
        reject(error);
      }
    });
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
  });
}
