import { PROTOCOL_VERSION, type ClientMsg, type ServerMsg, type PlayerInfo, type PoseNet } from './protocol';
import { WebSocketTransport, type Transport } from './transport';
import type { GameSession } from '../core/GameSession';
import { RemotePlayer } from './RemotePlayer';
import { MobSync } from './MobSync';
import type { ChestData, PaintingData } from '../world/WorldState';
import { applyRemotePainting } from '../world/paintings';
import type { CharacterSave } from '../save/types';
import { T } from '../world/TileRegistry';
import { h } from '../utils/dom';

export type Welcome = Extract<ServerMsg, { t: 'welcome' }>;
export interface Connection {
  net: NetworkManager;
  welcome: Welcome;
  players: PlayerInfo[];
}

/**
 * Client side of multiplayer. Relays local tile edits, chests, progression
 * flags, chat and player state; applies the same from other players.
 * Creatures/bosses remain client-simulated (documented limitation).
 */
export class NetworkManager {
  connected = false;
  id = -1;
  private queue: ServerMsg[] = [];
  private session: GameSession | null = null;
  private remotes = new Map<number, RemotePlayer>();
  private pending: number[] = [];
  private applyingRemote = false;
  /** Set while running deterministic world changes every client performs itself (the Unsealing). */
  suppressCapture = false;
  private stateTimer = 0;
  private chatEl: HTMLInputElement | null = null;
  private unsub: (() => void)[] = [];
  /** Shared creatures, hits, deaths and projectiles (created when the session attaches). */
  mobs: MobSync | null = null;

  private constructor(readonly transport: Transport) {}

  /** Take over the transport's events once the handshake is done. */
  private bind(): void {
    this.transport.onMessage = (m) => this.queue.push(m);
    this.transport.onClose = (reason) => {
      if (!this.connected) return;
      this.connected = false;
      // Kicked, banned or the connection is gone for good: back to the menu with the reason.
      this.session?.onDisconnected(reason);
    };
  }

  /** Connect to a self-hosted Node server. */
  static connect(url: string, c: CharacterSave, timeoutMs = 8000): Promise<Connection> {
    let t: Transport;
    try {
      t = new WebSocketTransport(url);
    } catch (e) {
      return Promise.reject(new Error(`Invalid server address: ${String(e)}`));
    }
    return NetworkManager.connectWith(t, c, timeoutMs, 'Connection timed out. Is the server running (npm run server)?');
  }

  /** Say hello over any transport and wait for the welcome (world seed + modifications). */
  static connectWith(t: Transport, c: CharacterSave, timeoutMs = 20000, timeoutMsg = 'Connection timed out.'): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const net = new NetworkManager(t);
      const fail = (reason: string) => {
        clearTimeout(timer);
        t.onMessage = null;
        t.close();
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail(timeoutMsg), timeoutMs);
      t.onClose = (reason) => fail(reason);
      t.onMessage = (m) => {
        if (m.t === 'reject') fail(m.reason);
        else if (m.t === 'welcome') {
          clearTimeout(timer);
          net.bind();
          net.connected = true;
          net.id = m.id;
          resolve({ net, welcome: m, players: m.players });
        } else net.queue.push(m);
      };
      t.send({ t: 'hello', version: PROTOCOL_VERSION, name: c.name, appearance: c.appearance });
    });
  }

  send(m: ClientMsg): void {
    this.transport.send(m);
  }

  attach(s: GameSession, players: PlayerInfo[] = this.initialPlayers): void {
    this.session = s;
    this.mobs = new MobSync(s, (m) => this.send(m));
    for (const p of players) if (p.id !== this.id) this.addRemote(p);
    this.unsub.push(
      s.world.onChange((x, y, layer) => {
        if (this.applyingRemote || this.suppressCapture || layer === 'liquid') return;
        this.pending.push(x, y, s.world.getFg(x, y), s.world.getFrame(x, y), s.world.getWall(x, y));
      }),
    );
    this.unsub.push(s.bus.on('flagSet', ({ flag }) => !this.applyingRemote && this.send({ t: 'flag', flag })));
    this.unsub.push(
      s.bus.on('worldEdit', (e) => {
        if (e.op === 'liquid') this.send({ t: 'liquid', x: e.x, y: e.y, amount: e.amount, type: e.type });
      }),
    );
    window.addEventListener('keydown', this.onKey);
  }

  initialPlayers: PlayerInfo[] = [];

  private onKey = (e: KeyboardEvent): void => {
    if (!this.session || !this.connected) return;
    if (e.code === 'Enter' && !this.chatEl && !this.session.host.input.typing) {
      e.preventDefault();
      this.chatEl = h('input', { type: 'text', maxlength: '200', placeholder: 'Say something... (Enter to send, Esc to cancel)', class: 'chat-input', 'aria-label': 'Chat message' });
      this.session.host.ui.root.appendChild(this.chatEl);
      this.session.host.input.typing = true;
      this.chatEl.focus();
      this.chatEl.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') {
          const text = this.chatEl!.value.trim();
          if (text) this.send({ t: 'chat', text });
          this.closeChat();
        } else if (ev.key === 'Escape') this.closeChat();
      });
    }
  };

  private closeChat(): void {
    this.chatEl?.remove();
    this.chatEl = null;
    if (this.session) this.session.host.input.typing = false;
  }

  private addRemote(p: PlayerInfo): void {
    if (!this.session || this.remotes.has(p.id)) return;
    const r = new RemotePlayer(p.id, p.name, p.appearance, p.x, p.y);
    this.remotes.set(p.id, r);
    this.session.entities.add(r);
  }

  update(s: GameSession): void {
    if (!this.connected) return;
    this.transport.update?.(s);
    this.mobs?.tick();
    for (const m of this.queue.splice(0)) this.handle(s, m);
    if (this.pending.length) {
      for (let i = 0; i < this.pending.length; i += 2500) this.send({ t: 'tiles', changes: this.pending.slice(i, i + 2500) });
      this.pending = [];
    }
    if (++this.stateTimer >= 4) {
      this.stateTimer = 0;
      const p = s.player;
      this.send({
        t: 'state', x: p.x, y: p.y, vx: p.vx, vy: p.vy, facing: p.facing, anim: p.dead ? 'dead' : p.anim,
        held: p.inventory.heldItem()?.id ?? null, armor: p.inventory.armor.slots.map((a) => a?.id ?? null), life: p.life, maxLife: p.maxLife,
        pose: this.pose(p),
      });
    }
  }

  /** What the player is doing with their held item, so others see swings and aiming. */
  private pose(p: GameSession['player']): PoseNet | null {
    const pose = p.use.pose(p);
    if (pose.armAngle === null && !pose.held) return null;
    const r = (v: number) => Math.round(v * 100) / 100;
    return [pose.armAngle === null ? null : r(pose.armAngle), pose.held?.id ?? null, pose.held?.style ?? 'hold', r(pose.held?.angle ?? 0), r(pose.held?.scale ?? 1)];
  }

  private handle(s: GameSession, m: ServerMsg): void {
    switch (m.t) {
      case 'join':
        this.addRemote(m.player);
        s.message(`${m.player.name} joined the world.`, '#9fd0ff');
        break;
      case 'leave': {
        const r = this.remotes.get(m.id);
        if (r) {
          r.removed = true;
          this.remotes.delete(m.id);
          s.message(`${r.name} left the world.`, '#9fd0ff');
        }
        break;
      }
      case 'state':
        this.remotes.get(m.id)?.applyState(m);
        break;
      case 'tiles':
        this.applyTiles(s, m.changes);
        break;
      case 'liquid':
        this.applyingRemote = true;
        s.world.setLiquid(m.x, m.y, m.amount, m.type);
        s.liquids.wake(m.x, m.y);
        this.applyingRemote = false;
        break;
      case 'chest':
        s.world.chests.set(s.world.chestKey(m.chest.x, m.chest.y), m.chest);
        s.inventory.refreshChest(m.chest);
        break;
      case 'paint':
        applyRemotePainting(s.world, m.painting);
        s.paint.refresh(m.painting);
        break;
      case 'flag':
        this.applyingRemote = true;
        s.progression.set(m.flag);
        this.applyingRemote = false;
        break;
      case 'chat':
        s.message(`<${m.name}> ${m.text}`, '#ffffff');
        break;
      case 'time':
        if (Math.abs(s.time.time - m.time) > 120) s.time.time = m.time;
        s.time.day = m.day;
        break;
      case 'mobs':
      case 'ev':
        this.mobs?.receive(m);
        break;
      default:
        break;
    }
  }

  private applyTiles(s: GameSession, c: number[]): void {
    const w = s.world;
    this.applyingRemote = true;
    for (let i = 0; i + 4 < c.length; i += 5) {
      const [x, y, fg, frame, wall] = [c[i], c[i + 1], c[i + 2], c[i + 3], c[i + 4]];
      if (!w.inBounds(x, y)) continue;
      const before = w.getFg(x, y);
      w.setFg(x, y, fg, frame);
      w.setWall(x, y, wall);
      if (fg === T.chest && frame === 0 && !w.chests.has(w.chestKey(x, y))) w.chests.set(w.chestKey(x, y), { x, y, items: new Array(40).fill(null) });
      if (before === T.chest && fg !== T.chest) w.chests.delete(w.chestKey(x, y));
      if (before !== fg) w.paintings.delete(w.chestKey(x, y));
    }
    this.applyingRemote = false;
  }

  sendChest(chest: ChestData): void {
    if (this.connected) this.send({ t: 'chest', chest });
  }

  sendPainting(painting: PaintingData): void {
    if (this.connected) this.send({ t: 'paint', painting });
  }

  sendChestOpen(_x: number, _y: number): void {
    /* Chest contents are pushed on every change; nothing to do on open. */
  }

  renderOverlay(_g: CanvasRenderingContext2D): void {}

  disconnect(): void {
    this.connected = false;
    for (const u of this.unsub) u();
    window.removeEventListener('keydown', this.onKey);
    this.closeChat();
    this.transport.close();
  }
}
