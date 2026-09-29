import type { World } from './World';
import { TileRegistry } from './TileRegistry';
import { isCanvasTile, isPainted } from './paintings';

export interface RoomCheck {
  valid: boolean;
  reason?: string;
  /** Top-left anchor used as a stable room id. */
  key?: number;
  standX?: number;
  standY?: number;
  cells?: number;
  minX?: number;
  maxX?: number;
  /** The flood fill closed off (the space is a room, whether or not an NPC would accept it). */
  enclosed?: boolean;
  /** Every interior cell has a player-placed background wall. */
  walled?: boolean;
  /** Decoration score: each kind of decoration counts once, plus bonuses (see roomComfort). */
  comfort?: number;
}

export interface ComfortTier {
  key: 'bare' | 'homely' | 'cozy' | 'lavish';
  name: string;
  min: number;
  /** NPC shop discount when this is their home. */
  discount: number;
  /** Buff while the player is inside. */
  buff?: string;
  /** Hearthglow duration (ticks) carried out of the room. */
  glow?: number;
}

export const COMFORT_TIERS: ComfortTier[] = [
  { key: 'bare', name: 'Bare', min: 0, discount: 0 },
  { key: 'homely', name: 'Homely', min: 10, discount: 0.03, buff: 'snug' },
  { key: 'cozy', name: 'Cozy', min: 20, discount: 0.08, buff: 'cozy', glow: 60 * 60 * 3 },
  { key: 'lavish', name: 'Lavish', min: 35, discount: 0.15, buff: 'lavish', glow: 60 * 60 * 6 },
];

export function comfortTier(score: number): ComfortTier {
  let t = COMFORT_TIERS[0];
  for (const c of COMFORT_TIERS) if (score >= c.min) t = c;
  return t;
}

/** Extra comfort for a blooming planter (once per room) and per painted canvas. */
export const BLOOM_BONUS = 3;
export const PAINTING_BONUS = 4;
export const MAX_PAINTINGS = 3;

/** Score a set of decoration kinds plus bonuses. */
export function roomComfort(kinds: Iterable<number>, blooming: boolean, paintings: number): number {
  let score = 0;
  for (const id of kinds) score += TileRegistry.get(id).comfort ?? 0;
  if (blooming) score += BLOOM_BONUS;
  return score + Math.min(MAX_PAINTINGS, paintings) * PAINTING_BONUS;
}

/** Planter frames pack the plant kind and growth stage: kind*4 + stage (stage 3 = bloom). */
export function planterBlooming(frame: number): boolean {
  return frame >> 2 > 0 && (frame & 3) === 3;
}

export const MIN_CELLS = 40;
export const MAX_CELLS = 750;

function isBoundary(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x, y)) return true;
  const def = TileRegistry.get(world.getFg(x, y));
  return (def.solid && !def.furniture?.includes('door')) || !!def.housingBoundary;
}

/**
 * Validate an NPC room by flood-filling the interior from (x,y).
 * A valid room is enclosed (40–750 cells), fully backed by player-placed
 * walls, has a door, a light source, a table and a chair.
 */
export function checkRoom(world: World, x: number, y: number): RoomCheck {
  if (isBoundary(world, x, y)) return { valid: false, reason: 'That is not an open space.' };
  const seen = new Set<number>();
  const stack: number[] = [x, y];
  let door = false;
  let light = false;
  let table = false;
  let chair = false;
  let missingWall = false;
  let minKey = Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let stand: [number, number] | null = null;
  const kinds = new Set<number>();
  const paintings = new Set<number>();
  let blooming = false;
  const planter = TileRegistry.tryId('planter');
  const note = (id: number, nx: number, ny: number) => {
    if (!TileRegistry.get(id).comfort) return;
    kinds.add(id);
    if (id === planter && planterBlooming(world.getFrame(nx, ny))) blooming = true;
    if (isCanvasTile(id)) {
      const [ox, oy] = world.objectOrigin(nx, ny);
      if (isPainted(world.paintings.get(world.chestKey(ox, oy)))) paintings.add(oy * world.width + ox);
    }
  };
  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    const k = cy * world.width + cx;
    if (seen.has(k)) continue;
    seen.add(k);
    if (seen.size > MAX_CELLS) return { valid: false, reason: 'This room is too large or not fully enclosed.' };
    if (k < minKey) minKey = k;
    minX = Math.min(minX, cx);
    maxX = Math.max(maxX, cx);
    const wall = world.getWall(cx, cy);
    if (!wall || TileRegistry.wall(wall).natural) missingWall = true;
    const fgId = world.getFg(cx, cy);
    const def = TileRegistry.get(fgId);
    const f = def.furniture;
    note(fgId, cx, cy);
    if (f?.includes('light') || def.light) light = true;
    if (f?.includes('table')) table = true;
    if (f?.includes('chair')) chair = true;
    if (!stand && world.isSolid(cx, cy + 1) && !isBoundary(world, cx, cy - 1) && !isBoundary(world, cx, cy - 2)) stand = [cx, cy];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBoundary(world, nx, ny)) {
        const nid = world.getFg(nx, ny);
        const nd = TileRegistry.get(nid);
        note(nid, nx, ny); // windows and doors in the walls count too
        if (nd.furniture?.includes('door')) door = true;
        if (nd.platform) door = true; // platforms act as trapdoors
        continue;
      }
      stack.push(nx, ny);
    }
  }
  const room = { enclosed: true, walled: !missingWall, comfort: roomComfort(kinds, blooming, paintings.size), key: minKey, cells: seen.size, minX, maxX };
  const fail = (reason: string): RoomCheck => ({ valid: false, reason, ...room });
  if (seen.size < MIN_CELLS) return fail(`This room is too small (${seen.size} of at least ${MIN_CELLS} open tiles).`);
  if (missingWall) return fail('This room is missing background walls.');
  if (!door) return fail('This room needs a door.');
  if (!light) return fail('This room needs a light source.');
  if (!table) return fail('This room needs a table or workbench.');
  if (!chair) return fail('This room needs a chair.');
  if (!stand) return fail('There is nowhere to stand.');
  return { valid: true, standX: stand[0], standY: stand[1], ...room };
}
