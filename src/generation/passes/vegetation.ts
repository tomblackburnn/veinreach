import type { GenContext } from '../GenContext';
import { SURFACE_BIOME_ORDER } from '../../biomes/BiomeDetector';
import { T, TileRegistry } from '../../world/TileRegistry';
import type { World } from '../../world/World';
import type { Rng } from '../../utils/random';

export const TREE_KIND = { oak: 0, pine: 1, palm: 2, dead: 3, mushroom: 4, shard: 5 } as const;

/** Plant a tree of a species at the ground position (x, groundY is the solid tile under the trunk). */
export function growTree(world: World, x: number, groundY: number, kind: number, height: number): boolean {
  for (let i = 1; i <= height + 2; i++) {
    const y = groundY - i;
    if (!world.inBounds(x, y) || (world.getFg(x, y) !== 0 && !TileRegistry.cuttable[world.getFg(x, y)])) return false;
  }
  for (let i = 1; i < height; i++) world.setFg(x, groundY - i, T.trunk, kind);
  world.setFg(x, groundY - height, T.treetop, kind);
  return true;
}

export function* vegetation(ctx: GenContext): Generator<number> {
  const { W, world } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('veg');
  const tall = TileRegistry.id('tallgrass');
  const flower = TileRegistry.id('flower');
  const thorn = TileRegistry.id('thornbrush');
  const glowshroom = TileRegistry.id('glowshroom');
  const emberbloom = TileRegistry.id('emberbloom');
  const stalactite = TileRegistry.id('stalactite');
  const crystal = TileRegistry.id('crystal_cluster');

  // Surface: grass, trees and plants.
  let lastTree = -10;
  for (let x = 2; x < W - 2; x++) {
    let y = 0;
    while (y < ctx.H - 1 && world.getFg(x, y) === 0) y++;
    const top = world.getFg(x, y);
    const biome = SURFACE_BIOME_ORDER[world.biomeColumn[x]];
    if (world.getLiquid(x, y - 1) > 0 || ctx.isProtected(x, y - 1)) continue;
    if (top === T.loam) world.setFg(x, y, biome === 'blightmire' ? T.blightgrass : T.meadowgrass, 0);
    const ground = world.getFg(x, y);
    const canTree = x - lastTree > 3 && !ctx.isProtected(x, y - 2);
    if (biome === 'meadow' && ground === T.meadowgrass) {
      if (canTree && rng.chance(0.16) && growTree(world, x, y, TREE_KIND.oak, rng.int(7, 15))) lastTree = x;
      else if (rng.chance(0.55)) world.setFg(x, y - 1, rng.chance(0.18) ? flower : tall, rng.int(0, 3));
    } else if (biome === 'taiga' && (ground === T.snow)) {
      if (canTree && rng.chance(0.2) && growTree(world, x, y, TREE_KIND.pine, rng.int(9, 17))) lastTree = x;
    } else if (biome === 'dunes' && ground === T.sand) {
      if (canTree && rng.chance(0.06)) {
        const h = rng.int(3, 5);
        for (let i = 1; i <= h; i++) if (world.getFg(x, y - i) === 0) world.setFg(x, y - i, T.cactus, i === h ? 1 : 0);
        lastTree = x;
      }
    } else if (biome === 'shore' && ground === T.sand) {
      if (canTree && rng.chance(0.07) && growTree(world, x, y, TREE_KIND.palm, rng.int(8, 13))) lastTree = x;
    } else if (biome === 'blightmire' && ground === T.blightgrass) {
      if (canTree && rng.chance(0.1) && growTree(world, x, y, TREE_KIND.dead, rng.int(6, 12))) lastTree = x;
      else if (rng.chance(0.2)) world.setFg(x, y - 1, thorn, 0);
      else if (rng.chance(0.3)) world.setFg(x, y - 1, tall, 4);
    }
    if ((x & 255) === 0) yield (x / W) * 0.4;
  }

  // Underground decoration: moss on mud, glowshrooms, stalactites, vines, crystals, emberblooms.
  for (let y = L.undergroundY; y < ctx.H - 3; y++) {
    for (let x = 2; x < W - 2; x++) {
      const id = world.getFg(x, y);
      if (id === 0 || ctx.isProtected(x, y)) continue;
      const above = world.getFg(x, y - 1);
      const below = world.getFg(x, y + 1);
      if (id === T.mud && above === 0 && world.getWall(x, y) === TileRegistry.wallId('mud_wall')) {
        world.setFg(x, y, T.lumenmoss, 0);
        if (rng.chance(0.35) && world.getLiquid(x, y - 1) === 0) {
          if (rng.chance(0.06) && growTree(world, x, y, TREE_KIND.mushroom, rng.int(5, 9))) continue;
          world.setFg(x, y - 1, glowshroom, rng.int(0, 2));
        }
      } else if (id === T.prismstone) {
        if (above === 0 && rng.chance(0.08)) world.setFg(x, y - 1, crystal, 0);
        else if (below === 0 && rng.chance(0.08)) world.setFg(x, y + 1, crystal, 1);
      } else if ((id === T.ash) && above === 0 && y > L.underworldY && rng.chance(0.05) && world.getLiquid(x, y - 1) === 0) {
        world.setFg(x, y - 1, emberbloom, 0);
      } else if ((id === T.stone || id === T.hushstone || id === T.ice) && below === 0 && rng.chance(0.03) && world.getLiquid(x, y + 1) === 0) {
        world.setFg(x, y + 1, stalactite, id === T.ice ? 1 : 0);
      }
    }
    if ((y & 31) === 0) yield 0.4 + ((y - L.undergroundY) / (ctx.H - L.undergroundY)) * 0.5;
  }

  // Vines under grass overhangs near the surface.
  for (let x = 2; x < W - 2; x++) {
    for (let y = world.surface[x] - 20; y < world.surface[x] + 30; y++) {
      const id = world.getFg(x, y);
      if ((id === T.meadowgrass || id === T.lumenmoss) && world.getFg(x, y + 1) === 0 && rng.chance(0.3)) {
        const len = rng.int(2, 7);
        for (let i = 1; i <= len && world.getFg(x, y + i) === 0; i++) world.setFg(x, y + i, T.vine, 0);
      }
    }
  }
  yield 1;
}

export function randomTreeHeight(rng: Rng, kind: number): number {
  return kind === TREE_KIND.pine ? rng.int(9, 16) : kind === TREE_KIND.mushroom ? rng.int(5, 9) : rng.int(7, 14);
}
