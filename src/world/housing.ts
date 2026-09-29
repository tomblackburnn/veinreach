import type { World } from './World';
import { TileRegistry } from './TileRegistry';

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
    const def = TileRegistry.get(world.getFg(cx, cy));
    const f = def.furniture;
    if (f?.includes('light') || def.light) light = true;
    if (f?.includes('table')) table = true;
    if (f?.includes('chair')) chair = true;
    if (!stand && world.isSolid(cx, cy + 1) && !isBoundary(world, cx, cy - 1) && !isBoundary(world, cx, cy - 2)) stand = [cx, cy];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBoundary(world, nx, ny)) {
        const nd = TileRegistry.get(world.getFg(nx, ny));
        if (nd.furniture?.includes('door')) door = true;
        if (nd.platform) door = true; // platforms act as trapdoors
        continue;
      }
      stack.push(nx, ny);
    }
  }
  if (seen.size < MIN_CELLS) return { valid: false, reason: `This room is too small (${seen.size} of at least ${MIN_CELLS} open tiles).` };
  if (missingWall) return { valid: false, reason: 'This room is missing background walls.' };
  if (!door) return { valid: false, reason: 'This room needs a door.' };
  if (!light) return { valid: false, reason: 'This room needs a light source.' };
  if (!table) return { valid: false, reason: 'This room needs a table or workbench.' };
  if (!chair) return { valid: false, reason: 'This room needs a chair.' };
  if (!stand) return { valid: false, reason: 'There is nowhere to stand.' };
  return { valid: true, key: minKey, standX: stand[0], standY: stand[1], cells: seen.size, minX, maxX };
}
