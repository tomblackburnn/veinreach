/**
 * Veinreach multiplayer server (experimental).
 *
 *   npm run server -- --port 7777 --world "My World" --seed 12345 --size medium
 *
 * Shares terrain, block edits, chests, paintings, time, progression flags,
 * chat, and creatures (each simulated by one player's game and mirrored)
 * between up to 8 players. Creatures are simulated client-side.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { WorldHost } from './WorldHost';
import { encode, decode, PROTOCOL_VERSION, MAX_PLAYERS, type ClientMsg, type ServerMsg, type PlayerInfo } from '../src/multiplayer/protocol';
import { sanitizeAppearance } from '../src/entities/player/Appearance';
import { WORLD_SIZES, type WorldSizeKey } from '../src/core/config';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const port = parseInt(arg('port', process.env.PORT ?? '7777'), 10);
const worldName = arg('world', 'Shared Realm');
const seed = arg('seed', String(Math.floor(Math.random() * 1e9)));
const sizeArg = arg('size', 'medium');
const size = (sizeArg in WORLD_SIZES ? sizeArg : 'medium') as WorldSizeKey;
const file = `server/data/${worldName.replace(/[^\w-]+/g, '_')}.json`;

const host = new WorldHost(file, worldName, seed, size);
host.load();

interface Client {
  id: number;
  ws: WebSocket;
  name: string;
  info: PlayerInfo | null;
  tx: number;
  ty: number;
  edits: number;
  msgs: number;
}

const clients = new Map<number, Client>();
let nextId = 1;

function send(ws: WebSocket, m: ServerMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(encode(m));
}

function broadcast(m: ServerMsg, except?: number): void {
  const data = encode(m);
  for (const c of clients.values()) if (c.id !== except && c.info && c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
}

const wss = new WebSocketServer({ port, maxPayload: 2 * 1024 * 1024 });
console.log(`[server] listening on ws://localhost:${port}`);

wss.on('connection', (ws) => {
  if (clients.size >= MAX_PLAYERS) {
    send(ws, { t: 'reject', reason: `Server is full (${MAX_PLAYERS} players).` });
    ws.close();
    return;
  }
  const c: Client = { id: nextId++, ws, name: 'Player', info: null, tx: host.spawnX, ty: host.spawnY, edits: 0, msgs: 0 };
  clients.set(c.id, c);

  ws.on('message', (raw) => {
    if (++c.msgs > 300) return; // per-second flood guard
    const m = decode<ClientMsg>(String(raw));
    if (!m || typeof m.t !== 'string') return;
    if (!c.info && m.t !== 'hello') return;
    switch (m.t) {
      case 'hello': {
        if (m.version !== PROTOCOL_VERSION) {
          send(ws, { t: 'reject', reason: `Version mismatch (server ${PROTOCOL_VERSION}, client ${m.version}).` });
          ws.close();
          return;
        }
        c.name = String(m.name ?? 'Player').slice(0, 24).replace(/[<>]/g, '') || 'Player';
        c.info = { id: c.id, name: c.name, appearance: sanitizeAppearance(m.appearance), x: host.spawnX * 16, y: host.spawnY * 16 };
        send(ws, {
          t: 'welcome', id: c.id, world: { name: host.name, seed: host.seed, size: host.size }, chunks: host.modifiedChunks(),
          chests: [...host.chests.values()], paintings: [...host.paintings.values()], time: host.time, day: host.day, flags: [...host.flags], spawnX: host.spawnX, spawnY: host.spawnY,
          players: [...clients.values()].filter((o) => o.info && o.id !== c.id).map((o) => o.info!),
        });
        broadcast({ t: 'join', player: c.info }, c.id);
        console.log(`[server] ${c.name} joined (${clients.size} online)`);
        break;
      }
      case 'state': {
        if (![m.x, m.y, m.vx, m.vy].every((v) => typeof v === 'number' && isFinite(v))) return;
        c.tx = Math.floor((m.x + 10) / 16);
        c.ty = Math.floor((m.y + 21) / 16);
        c.info!.x = m.x;
        c.info!.y = m.y;
        broadcast({ ...m, t: 'state', id: c.id, armor: Array.isArray(m.armor) ? m.armor.slice(0, 3) : [], held: typeof m.held === 'string' ? m.held : null }, c.id);
        break;
      }
      case 'tiles': {
        if ((c.edits += Array.isArray(m.changes) ? m.changes.length / 5 : 0) > 600) return; // rate limit per second
        const ok = host.applyTiles(m.changes, c.tx, c.ty);
        if (ok.length) broadcast({ t: 'tiles', id: c.id, changes: ok }, c.id);
        break;
      }
      case 'liquid':
        if ([m.x, m.y, m.amount, m.type].every(Number.isInteger) && host.world.inBounds(m.x, m.y) && Math.abs(m.x - c.tx) < 20 && Math.abs(m.y - c.ty) < 20) {
          host.world.setLiquid(m.x, m.y, Math.max(0, Math.min(255, m.amount)), m.type === 2 ? 2 : m.type === 1 ? 1 : 0);
          host.dirty = true;
          broadcast({ t: 'liquid', x: m.x, y: m.y, amount: m.amount, type: m.type }, c.id);
        }
        break;
      case 'chest': {
        const chest = host.validChest(m.chest);
        if (chest) broadcast({ t: 'chest', chest }, c.id);
        break;
      }
      case 'paint': {
        const painting = host.validPainting(m.painting, c.tx, c.ty);
        if (painting) broadcast({ t: 'paint', painting }, c.id);
        break;
      }
      case 'flag':
        if (typeof m.flag === 'string' && m.flag.length < 40 && !host.flags.has(m.flag)) {
          host.flags.add(m.flag);
          host.dirty = true;
          broadcast({ t: 'flag', flag: m.flag }, c.id);
        }
        break;
      case 'mobs':
        // Shared creatures: relayed as-is (each game validates what it applies).
        if (typeof m.tag === 'string' && m.tag.length <= 8 && Array.isArray(m.list) && m.list.length <= 200) broadcast({ t: 'mobs', tag: m.tag, list: m.list }, c.id);
        break;
      case 'ev':
        if (typeof m.tag === 'string' && m.tag.length <= 8 && Array.isArray(m.ev) && m.ev.length <= 400) broadcast({ t: 'ev', tag: m.tag, ev: m.ev }, c.id);
        break;
      case 'chat': {
        const text = String(m.text ?? '').slice(0, 200).trim();
        if (text) {
          broadcast({ t: 'chat', id: c.id, name: c.name, text });
          console.log(`[chat] ${c.name}: ${text}`);
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    clients.delete(c.id);
    if (c.info) {
      broadcast({ t: 'leave', id: c.id });
      console.log(`[server] ${c.name} left (${clients.size} online)`);
    }
  });
  ws.on('error', (e) => console.warn('[server] socket error', e.message));
});

// Clock, rate-limit reset and autosave.
let last = Date.now();
let timeBroadcast = 0;
setInterval(() => {
  const now = Date.now();
  host.tick(now - last);
  last = now;
  for (const c of clients.values()) {
    c.edits = 0;
    c.msgs = 0;
  }
  if (++timeBroadcast >= 5) {
    timeBroadcast = 0;
    broadcast({ t: 'time', time: host.time, day: host.day });
  }
}, 1000);

setInterval(() => {
  if (host.dirty) {
    host.save();
    console.log('[server] world saved');
  }
}, 60_000);

function shutdown(): void {
  console.log('[server] saving and shutting down...');
  try {
    host.save();
  } catch (e) {
    console.error('[server] save failed', e);
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
