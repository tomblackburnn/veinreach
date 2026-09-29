import type { GameContext } from '../core/context';
import { TileRegistry, T } from './TileRegistry';
import { placeObjectRaw } from './objects';
import { validateSupport } from './WorldActions';
import { checkRoom } from './housing';

export const HOUSE_W = 14; // outer width (12 interior)
export const HOUSE_H = 8; // outer height (6 interior)

/**
 * Build a complete, valid NPC house whose floor sits on row `floorY`, centred
 * on column `cx`. Refuses to overwrite chests or other furniture.
 * Returns an error message, or null on success.
 */
export function buildNpcHouse(ctx: GameContext, cx: number, floorY: number): string | null {
  const w = ctx.world;
  const x0 = cx - Math.floor(HOUSE_W / 2);
  const top = floorY - HOUSE_H + 1;
  if (x0 < 2 || top < 2 || x0 + HOUSE_W >= w.width - 2 || floorY >= w.height - 2) return 'Too close to the edge of the world.';
  // Never destroy player furniture or storage.
  for (let y = top - 1; y <= floorY; y++) {
    for (let x = x0 - 1; x <= x0 + HOUSE_W; x++) {
      const def = TileRegistry.get(w.getFg(x, y));
      if (def.furniture || def.station) return `There is a ${def.name} in the way.`;
      if (ctx.entities.npcs.some((n) => n.tileX === x && Math.floor(n.cy / 16) === y)) return 'A townsperson is standing there.';
    }
  }
  const plank = TileRegistry.id('timber');
  const wall = TileRegistry.wallId('timber_wall');
  // Clear the footprint (trees and plants above the roof are cleaned up by support checks).
  for (let y = top; y <= floorY; y++) {
    for (let x = x0; x < x0 + HOUSE_W; x++) {
      const edge = x === x0 || x === x0 + HOUSE_W - 1 || y === top || y === floorY;
      w.setLiquid(x, y, 0, 0);
      w.setFg(x, y, edge ? plank : 0, 0);
      if (!edge) w.setWall(x, y, wall);
    }
  }
  // Doors on both sides, resting on the floor.
  for (const dx of [0, HOUSE_W - 1]) {
    for (let y = floorY - 3; y < floorY; y++) w.setFg(x0 + dx, y, 0, 0);
    placeObjectRaw(w, x0 + dx, floorY - 3, T.doorClosed);
  }
  placeObjectRaw(w, x0 + 3, floorY - 2, TileRegistry.id('chair'));
  placeObjectRaw(w, x0 + 5, floorY - 2, TileRegistry.id('table'));
  w.setFg(x0 + HOUSE_W - 3, top + 2, T.torch, 0);
  // Anything that was resting on the cleared area (tree tops, plants) is re-checked.
  for (let x = x0 - 1; x <= x0 + HOUSE_W; x++) {
    validateSupport(ctx, x, top - 1, 0, false);
    validateSupport(ctx, x, floorY + 1, 0, false);
  }
  for (let y = top; y <= floorY; y++) {
    validateSupport(ctx, x0 - 1, y, 0, false);
    validateSupport(ctx, x0 + HOUSE_W, y, 0, false);
  }
  const r = checkRoom(w, x0 + 3, floorY - 1);
  return r.valid ? null : `House built but invalid: ${r.reason}`;
}
