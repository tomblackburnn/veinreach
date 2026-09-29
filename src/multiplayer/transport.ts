import { encode, decode, type ClientMsg, type ServerMsg } from './protocol';
import type { GameSession } from '../core/GameSession';

/**
 * How a multiplayer client talks to "the server". The WebSocket transport
 * talks to the Node server; the Firebase transport emulates the same server
 * messages on top of Realtime Database. NetworkManager only sees messages.
 */
export interface Transport {
  /** Short description for messages, e.g. "ws://host:7777" or "room ABC123". */
  readonly label: string;
  send(m: ClientMsg): void;
  onMessage: ((m: ServerMsg) => void) | null;
  /** Called once when the connection is gone for good. */
  onClose: ((reason: string) => void) | null;
  /** Called every game tick while in a session (for transports that need periodic work). */
  update?(s: GameSession): void;
  close(): void;
}

export class WebSocketTransport implements Transport {
  onMessage: ((m: ServerMsg) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  private ws: WebSocket;
  private outbox: string[] = [];

  constructor(readonly label: string) {
    this.ws = new WebSocket(label);
    this.ws.addEventListener('open', () => {
      for (const m of this.outbox.splice(0)) this.ws.send(m);
    });
    this.ws.addEventListener('message', (e) => {
      const m = decode<ServerMsg>(String(e.data));
      if (m) this.onMessage?.(m);
    });
    this.ws.addEventListener('error', () => this.onClose?.('Could not connect to the server.'));
    this.ws.addEventListener('close', () => this.onClose?.('Disconnected from server.'));
  }

  send(m: ClientMsg): void {
    const data = encode(m);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.outbox.push(data);
  }

  close(): void {
    this.onClose = null;
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}
