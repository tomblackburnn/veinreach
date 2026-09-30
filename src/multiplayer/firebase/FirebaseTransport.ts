import {
  ref, child, get, set, update, push, remove, onChildAdded, onChildChanged, onChildRemoved, onValue, onDisconnect, query, limitToLast, serverTimestamp,
  type DatabaseReference, type DataSnapshot, type Unsubscribe,
} from 'firebase/database';
import type { FirebaseHandle } from './client';
import { friendlyError } from './client';
import type { Transport } from '../transport';
import { PROTOCOL_VERSION, type ClientMsg, type ServerMsg, type PlayerInfo, type PlayerState } from '../protocol';
import { WORLD_SIZES, DAY_TICKS, type WorldSizeKey } from '../../core/config';
import { TileRegistry } from '../../world/TileRegistry';
import { sanitizeAppearance } from '../../entities/player/Appearance';
import { sanitizePainting, isPainted } from '../../world/paintings';
import type { ChestData, PaintingData } from '../../world/WorldState';
import type { GameSession } from '../../core/GameSession';
import { encodeTile, decodeTile, encodeLiquid, decodeLiquid, posKey, parsePosKey, sanitizeChest, sanitizeState, parseInfo } from './codec';

export interface RoomMeta {
  name: string;
  seed: string;
  size: WorldSizeKey;
  v: number;
  owner: string;
}

/** Who belongs to the room, for the in-game Online World panel. */
export interface RosterEntry {
  uid: string;
  name: string;
  online: boolean;
  owner: boolean;
  you: boolean;
}

export interface Roster {
  code: string;
  youOwn: boolean;
  locked: boolean;
  members: RosterEntry[];
  /** Only visible to the owner. */
  bans: { uid: string; name: string }[];
}

const TIME_WRITE_TICKS = 60 * 5;
const MAX_PATHS_PER_WRITE = 2000;

/**
 * Multiplayer over Firebase Realtime Database. There is no game server: this
 * class turns the client's protocol messages into database writes and turns
 * database changes back into the same server messages the Node server would
 * send, validating incoming data the way the server does.
 *
 * Room layout (rooms/<CODE>/…): meta, time, flags/<flag>, tiles/<index>,
 * liquids/<index>, chests/<x_y>, paintings/<x_y>, players/<uid>, chat/<id>.
 */
export class FirebaseTransport implements Transport {
  onMessage: ((m: ServerMsg) => void) | null = null;
  onClose: ((reason: string) => void) | null = null;
  readonly label: string;
  private base: DatabaseReference;
  private me: DatabaseReference;
  private unsubs: Unsubscribe[] = [];
  private closed = false;
  private width = 0;
  private height = 0;
  /** uid → small numeric id used by the protocol. */
  private ids = new Map<string, number>();
  private nextId = 1;
  /** Values this client wrote, so it can ignore their echoes (and stale echoes never undo newer local edits). */
  private echoes = new Map<string, number | string>();
  private chestKeys = new Set<string>();
  private paintings = new Map<string, PaintingData>();
  private info = '';
  private lastState = '';
  private stateTick = 0;
  private timeTick = 0;
  private wasConnected = true;

  private owner = '';
  private locked = false;
  private members = new Map<string, string>();
  private online = new Set<string>();
  private bans = new Map<string, string>();
  /** Called whenever membership, presence, bans or the lock change. */
  onRoster: ((r: Roster) => void) | null = null;

  constructor(private fb: FirebaseHandle, readonly code: string, private username: string) {
    this.label = `online world ${code}`;
    this.base = ref(fb.db, `rooms/${code}`);
    this.me = child(this.base, `players/${fb.uid}`);
  }

  send(m: ClientMsg): void {
    if (this.closed) return;
    switch (m.t) {
      case 'hello':
        void this.hello(m.name, m.appearance).catch((e: unknown) => this.emit({ t: 'reject', reason: friendlyError(e) }));
        break;
      case 'state':
        this.sendState(m);
        break;
      case 'tiles':
        this.sendTiles(m.changes);
        break;
      case 'liquid':
        if ([m.x, m.y, m.amount, m.type].every(Number.isInteger) && this.inBounds(m.x, m.y)) {
          const k = String(m.y * this.width + m.x);
          const v = encodeLiquid(Math.max(0, Math.min(255, m.amount)), m.type === 2 ? 2 : m.type === 1 ? 1 : 0);
          this.echoes.set(`l${k}`, v);
          this.write(set(child(this.base, `liquids/${k}`), v));
        }
        break;
      case 'chest': {
        const json = JSON.stringify(m.chest);
        const k = posKey(m.chest.x, m.chest.y);
        this.echoes.set(`c${k}`, json);
        this.chestKeys.add(k);
        this.write(set(child(this.base, `chests/${k}`), json));
        break;
      }
      case 'paint': {
        const p = sanitizePainting(m.painting);
        if (!p) break;
        const k = posKey(p.x, p.y);
        if (isPainted(p)) {
          const json = JSON.stringify({ w: p.w, h: p.h, px: p.px });
          this.echoes.set(`p${k}`, json);
          this.paintings.set(k, p);
          this.write(set(child(this.base, `paintings/${k}`), json));
        } else if (this.paintings.delete(k)) this.write(remove(child(this.base, `paintings/${k}`)));
        break;
      }
      case 'flag':
        if (/^[A-Za-z0-9:_-]{1,40}$/.test(m.flag)) this.write(set(child(this.base, `flags/${m.flag}`), true), true);
        break;
      case 'chat': {
        const text = String(m.text ?? '').slice(0, 200).trim();
        if (text) this.write(push(child(this.base, 'chat'), { uid: this.fb.uid, name: this.name, text, t: serverTimestamp() }));
        break;
      }
    }
  }

  update(s: GameSession): void {
    // One player (the lowest uid present) keeps the shared clock in step.
    if (++this.timeTick >= TIME_WRITE_TICKS) {
      this.timeTick = 0;
      const lowest = [this.fb.uid, ...this.ids.keys()].sort()[0];
      if (lowest === this.fb.uid) {
        const v = { time: Math.floor(s.time.time), day: s.time.day };
        this.echoes.set('time', JSON.stringify(v));
        this.write(set(child(this.base, 'time'), v));
      }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    void remove(this.me).catch(() => undefined);
    void onDisconnect(this.me).cancel().catch(() => undefined);
  }

  // ---------------------------------------------------------------------------

  private name = 'Player';

  private emit(m: ServerMsg): void {
    if (!this.closed) this.onMessage?.(m);
  }

  private write(p: PromiseLike<unknown>, quiet = false): void {
    Promise.resolve(p).catch((e: unknown) => {
      // Permission errors for duplicate flags are expected (flags are write-once).
      if (!quiet) console.warn('[Firebase] write failed', e);
    });
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private idFor(uid: string): number {
    let id = this.ids.get(uid);
    if (id === undefined) {
      id = this.nextId++;
      this.ids.set(uid, id);
    }
    return id;
  }

  private async hello(_character: string, appearance: unknown): Promise<void> {
    // Online, everyone is known by their account username (the rules enforce it).
    this.name = this.username;
    const metaSnap = await get(child(this.base, 'meta'));
    if (!metaSnap.exists()) {
      this.emit({ t: 'reject', reason: `There is no online world with the code ${this.code}.` });
      return;
    }
    const meta = metaSnap.val() as RoomMeta;
    if (meta.v !== PROTOCOL_VERSION) {
      this.emit({ t: 'reject', reason: `That world was made with a different game version (${meta.v}, you have ${PROTOCOL_VERSION}). Refresh the page to update.` });
      return;
    }
    if (!(meta.size in WORLD_SIZES)) {
      this.emit({ t: 'reject', reason: 'That online world has invalid settings.' });
      return;
    }
    ({ width: this.width, height: this.height } = WORLD_SIZES[meta.size]);
    this.owner = meta.owner;
    const refusal = await this.joinAsMember();
    if (refusal) {
      this.emit({ t: 'reject', reason: refusal });
      return;
    }
    this.info = JSON.stringify({ name: this.name, appearance: sanitizeAppearance(appearance) });
    await this.announce();

    const tiles: number[] = [];
    const liquids: number[] = [];
    const chests: ChestData[] = [];
    const flags: string[] = [];
    const players: PlayerInfo[] = [];
    await Promise.all([
      this.watch('tiles', (k, v, initial) => this.onTile(k, v, initial ? tiles : null)),
      this.watch('liquids', (k, v, initial) => this.onLiquid(k, v, initial ? liquids : null)),
      this.watch('chests', (k, v, initial) => this.onChest(k, v, initial ? chests : null), (k) => this.chestKeys.delete(k)),
      this.watch('paintings', (k, v, initial) => this.onPainting(k, v, initial)),
      this.watch('flags', (k, _v, initial) => (initial ? flags.push(k) : this.emit({ t: 'flag', flag: k }))),
      this.watch('players', (k, v, initial) => this.onPlayer(k, v, initial ? players : null), (k) => this.onPlayerLeft(k)),
      this.watch('members', (k, v) => this.onMember(k, v), (k) => this.onMemberRemoved(k)),
      this.watchChat(),
      ...(this.owner === this.fb.uid ? [this.watch('bans', (k, v) => this.onBan(k, v), (k) => this.onUnban(k))] : []),
    ]);
    this.watchOwnMembership();
    this.unsubs.push(
      onValue(child(this.base, 'settings/locked'), (snap) => {
        this.locked = snap.val() === true;
        this.rosterChanged();
      }),
    );
    const timeSnap = await get(child(this.base, 'time'));
    const tv = timeSnap.val() as { time?: unknown; day?: unknown } | null;
    this.unsubs.push(
      onValue(child(this.base, 'time'), (snap) => {
        const v = snap.val() as { time?: unknown; day?: unknown } | null;
        if (!v || typeof v.time !== 'number' || typeof v.day !== 'number') return;
        if (this.echoes.get('time') === JSON.stringify({ time: v.time, day: v.day })) return;
        this.emit({ t: 'time', time: v.time, day: v.day });
      }),
    );
    this.watchConnection();
    this.emit({
      t: 'welcome',
      id: 0,
      world: { name: meta.name, seed: meta.seed, size: meta.size },
      chunks: [],
      tiles,
      liquids,
      chests,
      paintings: [...this.paintings.values()],
      time: typeof tv?.time === 'number' ? tv.time : DAY_TICKS * (7.5 / 24),
      day: typeof tv?.day === 'number' ? tv.day : 1,
      flags,
      spawnX: -1,
      spawnY: -1,
      players,
    });
  }

  /**
   * Make sure we're allowed in: not banned, and either already a member or
   * the room isn't locked (then join). Returns why we can't join, or null.
   */
  private async joinAsMember(): Promise<string | null> {
    const uid = this.fb.uid;
    try {
      if ((await get(child(this.base, `bans/${uid}`))).exists()) return 'You have been banned from this world by its owner.';
      const member = await get(child(this.base, `members/${uid}`));
      if (!member.exists()) {
        if ((await get(child(this.base, 'settings/locked'))).val() === true) return 'This world is locked: its owner isn’t letting new players join right now.';
        await set(child(this.base, `members/${uid}`), { name: this.username, joined: serverTimestamp() });
      }
      // The same account can only be in a world once (another tab or device).
      for (let tries = 0; tries < 3; tries++) {
        if (!(await get(this.me)).exists()) return null;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return 'You’re already playing in this world (in another tab or on another device).';
    } catch (e) {
      return friendlyError(e);
    }
  }

  /** Write our player entry and make the database remove it if we vanish. */
  private async announce(): Promise<void> {
    await onDisconnect(this.me).remove();
    await set(this.me, { name: this.username, info: this.info, s: this.lastState || JSON.stringify({ x: 0, y: 0, vx: 0, vy: 0, facing: 1, anim: 'idle', held: null, armor: [], life: 100, maxLife: 100 }) });
  }

  /** Report connection drops; on reconnect, re-announce (onDisconnect removed our entry). */
  private watchConnection(): void {
    this.unsubs.push(
      onValue(ref(this.fb.db, '.info/connected'), (snap) => {
        const up = snap.val() === true;
        if (up === this.wasConnected) return;
        this.wasConnected = up;
        if (!up) this.emit({ t: 'chat', id: -1, name: 'Veinreach', text: 'Connection lost — reconnecting…' });
        else {
          void this.announce().catch(() => undefined);
          this.emit({ t: 'chat', id: -1, name: 'Veinreach', text: 'Reconnected.' });
        }
      }),
    );
  }

  /**
   * Listen to a collection. Existing children arrive first (initial = true);
   * the one-off value listener on the same location fires after them, which
   * marks the end of the initial snapshot without downloading it twice.
   */
  private watch(path: string, onSet: (key: string, val: unknown, initial: boolean) => void, onRemoved?: (key: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = child(this.base, path);
      let ready = false;
      const cb = (snap: DataSnapshot) => snap.key && onSet(snap.key, snap.val(), !ready);
      this.unsubs.push(onChildAdded(r, cb, reject));
      this.unsubs.push(onChildChanged(r, cb));
      if (onRemoved) this.unsubs.push(onChildRemoved(r, (snap) => snap.key && onRemoved(snap.key)));
      this.unsubs.push(
        onValue(
          r,
          () => {
            ready = true;
            resolve();
          },
          reject,
          { onlyOnce: true },
        ),
      );
    });
  }

  /** Only new chat messages are shown (not the backlog). */
  private watchChat(): Promise<void> {
    return new Promise((resolve) => {
      const q = query(child(this.base, 'chat'), limitToLast(1));
      let ready = false;
      this.unsubs.push(
        onChildAdded(q, (snap) => {
          if (!ready) return;
          const v = snap.val() as { uid?: unknown; name?: unknown; text?: unknown } | null;
          if (!v || typeof v.text !== 'string' || typeof v.name !== 'string') return;
          const id = v.uid === this.fb.uid ? 0 : (this.ids.get(String(v.uid)) ?? -1);
          this.emit({ t: 'chat', id, name: v.name.slice(0, 24).replace(/[<>]/g, ''), text: v.text.slice(0, 200) });
        }),
      );
      this.unsubs.push(
        onValue(
          q,
          () => {
            ready = true;
            resolve();
          },
          { onlyOnce: true },
        ),
      );
    });
  }

  private isEcho(key: string, v: number | string): boolean {
    if (this.echoes.get(key) !== v) return false;
    this.echoes.delete(key);
    return true;
  }

  private onTile(k: string, v: unknown, initial: number[] | null): void {
    const idx = Number(k);
    if (!Number.isInteger(idx) || typeof v !== 'number') return;
    if (!initial && this.isEcho(`t${k}`, v)) return;
    const x = idx % this.width;
    const y = Math.floor(idx / this.width);
    const [fg, frame, wall] = decodeTile(v);
    if (!this.inBounds(x, y) || !TileRegistry.defs[fg] || wall >= TileRegistry.walls.length) return;
    if (initial) initial.push(x, y, fg, frame, wall);
    else this.emit({ t: 'tiles', id: 0, changes: [x, y, fg, frame, wall] });
  }

  private onLiquid(k: string, v: unknown, initial: number[] | null): void {
    const idx = Number(k);
    if (!Number.isInteger(idx) || typeof v !== 'number') return;
    if (!initial && this.isEcho(`l${k}`, v)) return;
    const x = idx % this.width;
    const y = Math.floor(idx / this.width);
    const [amount, type] = decodeLiquid(v);
    if (!this.inBounds(x, y) || type > 2) return;
    if (initial) initial.push(x, y, amount, type);
    else this.emit({ t: 'liquid', x, y, amount, type });
  }

  private onChest(k: string, v: unknown, initial: ChestData[] | null): void {
    if (!initial && typeof v === 'string' && this.isEcho(`c${k}`, v)) return;
    const c = sanitizeChest(v);
    const pos = parsePosKey(k);
    if (!c || !pos || c.x !== pos[0] || c.y !== pos[1]) return;
    this.chestKeys.add(k);
    if (initial) initial.push(c);
    else this.emit({ t: 'chest', chest: c });
  }

  private onPainting(k: string, v: unknown, initial: boolean): void {
    if (!initial && typeof v === 'string' && this.isEcho(`p${k}`, v)) return;
    const pos = parsePosKey(k);
    if (!pos || typeof v !== 'string') return;
    let raw: unknown;
    try {
      raw = { ...(JSON.parse(v) as object), x: pos[0], y: pos[1] };
    } catch {
      return;
    }
    const p = sanitizePainting(raw);
    if (!p) return;
    this.paintings.set(k, p);
    if (!initial) this.emit({ t: 'paint', painting: p });
  }

  private onPlayer(uid: string, v: unknown, initial: PlayerInfo[] | null): void {
    if (!this.online.has(uid)) {
      this.online.add(uid);
      this.rosterChanged();
    }
    if (uid === this.fb.uid) return;
    const e = v as { name?: unknown; info?: unknown; s?: unknown } | null;
    const info = parseInfo(e?.info);
    const st = sanitizeState(e?.s);
    if (!info) return;
    if (typeof e?.name === 'string') info.name = e.name.slice(0, 16);
    const known = this.ids.has(uid);
    const id = this.idFor(uid);
    if (initial || !known) {
      const p: PlayerInfo = { id, name: info.name, appearance: sanitizeAppearance(info.appearance), x: st?.x ?? 0, y: st?.y ?? 0 };
      if (initial) initial.push(p);
      else this.emit({ t: 'join', player: p });
    }
    if (st && !initial) this.emit({ t: 'state', id, ...st });
  }

  private onPlayerLeft(uid: string): void {
    if (this.online.delete(uid)) this.rosterChanged();
    const id = this.ids.get(uid);
    if (id === undefined) return;
    this.ids.delete(uid);
    this.emit({ t: 'leave', id });
  }

  private onMember(uid: string, v: unknown): void {
    const name = (v as { name?: unknown } | null)?.name;
    this.members.set(uid, typeof name === 'string' ? name.slice(0, 16) : '?');
    this.rosterChanged();
  }

  private onMemberRemoved(uid: string): void {
    this.members.delete(uid);
    this.rosterChanged();
  }

  /**
   * Our own membership entry stays readable to us even after we lose access
   * to the rest of the room, so this is how a kicked or banned player finds out.
   */
  private watchOwnMembership(): void {
    const removed = () => void this.removedFromRoom();
    this.unsubs.push(onValue(child(this.base, `members/${this.fb.uid}`), (snap) => !snap.exists() && removed(), removed));
  }

  private async removedFromRoom(): Promise<void> {
    if (this.closed) return;
    let banned = false;
    try {
      banned = (await get(child(this.base, `bans/${this.fb.uid}`))).exists();
    } catch {
      /* the room may have been deleted */
    }
    const reason = banned ? 'You have been banned from this world by its owner.' : 'You were removed from this world (by its owner, or the world was deleted).';
    this.close();
    this.onClose?.(reason);
  }

  private onBan(uid: string, v: unknown): void {
    const name = (v as { name?: unknown } | null)?.name;
    this.bans.set(uid, typeof name === 'string' ? name : '?');
    this.rosterChanged();
  }

  private onUnban(uid: string): void {
    this.bans.delete(uid);
    this.rosterChanged();
  }

  private rosterChanged(): void {
    this.onRoster?.(this.roster());
  }

  roster(): Roster {
    const members: RosterEntry[] = [...this.members].map(([uid, name]) => ({ uid, name, online: this.online.has(uid), owner: uid === this.owner, you: uid === this.fb.uid }));
    members.sort((a, b) => Number(b.owner) - Number(a.owner) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
    return { code: this.code, youOwn: this.owner === this.fb.uid, locked: this.locked, members, bans: [...this.bans].map(([uid, name]) => ({ uid, name })) };
  }

  // ---- Owner tools (the rules reject these from anyone but the owner) ----

  kick(uid: string): Promise<void> {
    return update(this.base, { [`members/${uid}`]: null, [`players/${uid}`]: null });
  }

  ban(uid: string): Promise<void> {
    const name = this.members.get(uid) ?? '?';
    return update(this.base, { [`bans/${uid}`]: { name, at: serverTimestamp() }, [`members/${uid}`]: null, [`players/${uid}`]: null });
  }

  unban(uid: string): Promise<void> {
    return remove(child(this.base, `bans/${uid}`));
  }

  setLocked(locked: boolean): Promise<void> {
    return set(child(this.base, 'settings/locked'), locked);
  }

  private sendState(m: PlayerState): void {
    // ~7.5 updates a second, and nothing at all while standing still.
    if (++this.stateTick % 2) return;
    const json = JSON.stringify({ x: Math.round(m.x), y: Math.round(m.y), vx: +m.vx.toFixed(2), vy: +m.vy.toFixed(2), facing: m.facing, anim: m.anim, held: m.held, armor: m.armor, life: m.life, maxLife: m.maxLife });
    if (json === this.lastState) return;
    this.lastState = json;
    this.write(set(child(this.me, 's'), json));
  }

  private sendTiles(changes: number[]): void {
    const chest = TileRegistry.id('chest');
    let updates: Record<string, unknown> = {};
    let n = 0;
    const flush = () => {
      if (n) this.write(update(this.base, updates));
      updates = {};
      n = 0;
    };
    for (let i = 0; i + 4 < changes.length; i += 5) {
      const [x, y, fg, frame, wall] = changes.slice(i, i + 5);
      if (![x, y, fg, frame, wall].every(Number.isInteger) || !this.inBounds(x, y)) continue;
      if (!TileRegistry.defs[fg] || wall < 0 || wall >= TileRegistry.walls.length || frame < 0 || frame > 255) continue;
      const k = String(y * this.width + x);
      const v = encodeTile(fg, frame, wall);
      this.echoes.set(`t${k}`, v);
      updates[`tiles/${k}`] = v;
      n++;
      // Objects that were removed take their stored data with them.
      const pk = posKey(x, y);
      if (fg !== chest && this.chestKeys.delete(pk)) {
        updates[`chests/${pk}`] = null;
        n++;
      }
      if (this.paintings.has(pk) && !TileRegistry.get(fg).key.startsWith('canvas_')) {
        this.paintings.delete(pk);
        updates[`paintings/${pk}`] = null;
        n++;
      }
      if (n >= MAX_PATHS_PER_WRITE) flush();
    }
    flush();
  }
}
