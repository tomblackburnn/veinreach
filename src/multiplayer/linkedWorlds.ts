import type { World } from '../world/World';
import type { WorldState, PendingOnline, ChestData, PaintingData } from '../world/WorldState';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/context';
import { encodeTile, decodeTile } from './firebase/codec';
import { applyRemotePainting } from '../world/paintings';
import { TileRegistry } from '../world/TileRegistry';

/**
 * Linked worlds: the host's single-player save of an online world.
 *
 *  - Playing it in single-player records every edit in `state.pendingOnline`.
 *  - Opening it in single-player first pulls what others changed online
 *    (except tiles/chests/paintings the host changed offline, which win).
 *  - Playing it online pushes the pending edits to everyone, and saves the
 *    online world back into the local copy.
 */
export function emptyPending(): PendingOnline {
  return { tiles: {}, chests: [], paintings: [], flags: [] };
}

export function pendingCount(p: PendingOnline | undefined): number {
  return p ? Object.keys(p.tiles).length + p.chests.length + p.paintings.length + p.flags.length : 0;
}

const addKey = (list: string[], k: string) => {
  if (!list.includes(k)) list.push(k);
};

/** Record single-player edits of a linked world. Returns an unsubscribe function. */
export function trackOfflineEdits(world: World, state: WorldState, bus: EventBus<GameEvents>): () => void {
  const pending = (state.pendingOnline ??= emptyPending());
  const offChange = world.onChange((x, y, layer) => {
    if (layer === 'liquid') return;
    pending.tiles[String(y * world.width + x)] = encodeTile(world.getFg(x, y), world.getFrame(x, y), world.getWall(x, y));
  });
  const offFlag = bus.on('flagSet', ({ flag }) => addKey(pending.flags, flag));
  return () => {
    offChange();
    offFlag();
  };
}

export function markPending(state: WorldState, kind: 'chests' | 'paintings', key: string): void {
  addKey((state.pendingOnline ??= emptyPending())[kind], key);
}

/** What an online world currently holds (as fetched for a single-player sync). */
export interface RoomSnapshot {
  tiles: number[];
  liquids: number[];
  chests: ChestData[];
  paintings: PaintingData[];
  flags: string[];
  time?: number;
  day?: number;
}

/**
 * Bring a single-player copy up to date with its online world. Anything the
 * host changed offline (still pending upload) is kept. Returns tiles changed.
 */
export function applyRoomSnapshot(world: World, state: WorldState, snap: RoomSnapshot): number {
  const pending = state.pendingOnline ?? emptyPending();
  let changed = 0;
  const was = world.generating;
  world.generating = true;
  for (let i = 0; i + 4 < snap.tiles.length; i += 5) {
    const [x, y, fg, frame, wall] = snap.tiles.slice(i, i + 5);
    if (!world.inBounds(x, y) || pending.tiles[String(y * world.width + x)] !== undefined) continue;
    if (world.getFg(x, y) === fg && world.getFrame(x, y) === frame && world.getWall(x, y) === wall) continue;
    world.setFg(x, y, fg, frame);
    world.setWall(x, y, wall);
    world.markModified(x, y);
    changed++;
  }
  for (let i = 0; i + 3 < snap.liquids.length; i += 4) {
    const [x, y, amount, type] = snap.liquids.slice(i, i + 4);
    if (world.inBounds(x, y) && pending.tiles[String(y * world.width + x)] === undefined) {
      world.setLiquid(x, y, amount, type);
      world.markModified(x, y);
    }
  }
  world.generating = was;
  world.recomputeSkyTop();
  const chestId = TileRegistry.id('chest');
  for (const c of snap.chests) {
    const k = world.chestKey(c.x, c.y);
    if (!pending.chests.includes(k)) world.chests.set(k, c);
  }
  for (const [k, c] of world.chests) if (world.getFg(c.x, c.y) !== chestId) world.chests.delete(k);
  for (const p of snap.paintings) if (!pending.paintings.includes(world.chestKey(p.x, p.y))) applyRemotePainting(world, p);
  // Flags: union. If the world was unsealed online, let this copy replay the Unsealing itself.
  const had = new Set(state.flags);
  const wasUnsealed = had.has('unsealed');
  for (const f of snap.flags) if (f !== 'unseal:done' || wasUnsealed) had.add(f);
  state.flags = [...had];
  state.chests = [...world.chests.values()];
  state.paintings = [...world.paintings.values()];
  if (typeof snap.time === 'number') state.time = snap.time;
  if (typeof snap.day === 'number') state.day = Math.max(state.day, snap.day);
  return changed;
}

/** The pieces of a pending upload, decoded for applying to an online session. */
export function pendingTiles(p: PendingOnline, width: number): [number, number, number, number, number][] {
  return Object.entries(p.tiles).map(([k, v]) => {
    const idx = Number(k);
    const [fg, frame, wall] = decodeTile(v);
    return [idx % width, Math.floor(idx / width), fg, frame, wall];
  });
}
