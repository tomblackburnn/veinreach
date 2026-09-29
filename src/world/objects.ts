import { TileRegistry } from './TileRegistry';
import type { World } from './World';

/** Encode a multi-tile frame offset. */
export const frameOf = (ox: number, oy: number): number => (ox & 15) | ((oy & 15) << 4);

/** Place a (possibly multi-tile) object with its origin at the top-left. No validation. */
export function placeObjectRaw(world: World, x: number, y: number, tileId: number): void {
  const def = TileRegistry.get(tileId);
  const [w, h] = def.size ?? [1, 1];
  for (let oy = 0; oy < h; oy++) {
    for (let ox = 0; ox < w; ox++) {
      world.setFg(x + ox, y + oy, tileId, def.size ? frameOf(ox, oy) : 0);
    }
  }
}

/** Remove the whole object occupying (x,y). Returns its origin. */
export function removeObjectRaw(world: World, x: number, y: number): [number, number] {
  const id = world.getFg(x, y);
  const def = TileRegistry.get(id);
  const [ox, oy] = world.objectOrigin(x, y);
  const [w, h] = def.size ?? [1, 1];
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (world.getFg(ox + xx, oy + yy) === id) world.setFg(ox + xx, oy + yy, 0, 0);
    }
  }
  return [ox, oy];
}

/** True if every cell of a w×h footprint is empty (or cuttable) and the floor below is solid. */
export function canPlaceFootprint(world: World, x: number, y: number, w: number, h: number, needFloor: boolean): boolean {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (!world.inBounds(x + xx, y + yy)) return false;
      const id = world.getFg(x + xx, y + yy);
      if (id !== 0 && !TileRegistry.cuttable[id]) return false;
    }
  }
  if (needFloor) {
    for (let xx = 0; xx < w; xx++) {
      const below = world.getFg(x + xx, y + h);
      if (!(TileRegistry.solid[below] || TileRegistry.platform[below] || isFlatTop(below))) return false;
    }
  }
  return true;
}

/** Furniture tops that other objects may rest on (tables, workbenches). */
function isFlatTop(id: number): boolean {
  const f = TileRegistry.get(id).furniture;
  return !!f && f.includes('table');
}
