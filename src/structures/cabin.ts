import type { GenContext } from '../generation/GenContext';
import type { Rng } from '../utils/random';
import { buildRoom, placeTorch, areaFree } from './common';

/** Abandoned delver's cabin buried underground. */
export function buildCabin(ctx: GenContext, rng: Rng, x: number, y: number, loot: string): boolean {
  const w = rng.int(11, 16);
  const h = rng.int(7, 9);
  if (!areaFree(ctx, x, y, w, h)) return false;
  const shells = [
    ['timber', 'timber_wall'],
    ['stone_brick', 'stone_brick_wall'],
    ['kiln_brick', 'kiln_brick_wall'],
  ];
  const [shell, wall] = rng.pick(shells);
  buildRoom(ctx, x, y, w, h, { shell, wall, decay: 0.06 }, rng);
  // Side doorways.
  for (const dx of [0, w - 1]) for (let dy = h - 4; dy < h - 1; dy++) ctx.world.setFg(x + dx, y + dy, 0, 0);
  const floorY = y + h - 1;
  ctx.addChest(x + rng.int(2, w - 5), floorY - 2, loot, rng);
  if (rng.chance(0.6)) ctx.placeObject(x + w - 4, floorY - 1, 'workbench');
  placeTorch(ctx, x + 2, y + 2);
  if (rng.chance(0.7)) ctx.placeObject(x + w - 3, y + 1, 'cobweb');
  ctx.addStructure('cabin', 'Abandoned Cabin', x, y, w, h);
  return true;
}
