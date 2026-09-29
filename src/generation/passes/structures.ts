import type { GenContext } from '../GenContext';
import { SURFACE_BIOME_ORDER } from '../../biomes/BiomeDetector';
import { buildCabin } from '../../structures/cabin';
import { buildKeep } from '../../structures/keep';
import { buildDuneVault, buildMineshaft, buildShrine, buildSkyIsle, buildSpire, buildVitalChamber, buildSurfaceRuin } from '../../structures/misc';
import { T, TileRegistry } from '../../world/TileRegistry';

export function* placeStructures(ctx: GenContext): Generator<number> {
  const { W, world } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('structures');
  const colKey = (x: number) => SURFACE_BIOME_ORDER[world.biomeColumn[x]];

  // Warden's Keep between the outer biomes and the shore on keepSide.
  const shore = Math.floor(W * 0.035) + 20;
  const keepX = ctx.keepSide === 1 ? W - shore - Math.floor(W * 0.06) : shore + Math.floor(W * 0.06);
  buildKeep(ctx, rng.fork('keep'), keepX);
  yield 0.15;

  // Dune vault.
  const duneCols: number[] = [];
  for (let x = 0; x < W; x++) if (colKey(x) === 'dunes') duneCols.push(x);
  if (duneCols.length > 40) buildDuneVault(ctx, rng.fork('vault'), duneCols[Math.floor(duneCols.length / 2)]);
  yield 0.25;

  // Sky isles.
  const isles = Math.max(2, Math.floor(W / 700));
  for (let i = 0; i < isles; i++) {
    const x = Math.floor(W * (0.12 + (0.76 * (i + 0.5)) / isles)) + rng.int(-40, 40);
    const y = rng.int(Math.max(18, L.surfaceY - 110), Math.max(30, L.surfaceY - 60));
    buildSkyIsle(ctx, rng.fork('isle' + i), x, y);
  }
  yield 0.35;

  // Mineshafts, avoiding spawn and the keep.
  for (let i = 0; i < Math.max(1, Math.floor(W / 1100)); i++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = rng.int(Math.floor(W * 0.15), Math.floor(W * 0.85));
      if (Math.abs(x - W / 2) < 80 || Math.abs(x - keepX) < 80 || colKey(x) === 'dunes') continue;
      buildMineshaft(ctx, rng.fork('shaft' + i), x);
      break;
    }
  }
  // Surface ruins.
  for (let i = 0; i < Math.max(2, Math.floor(W / 900)); i++) {
    const x = rng.int(Math.floor(W * 0.12), Math.floor(W * 0.88));
    if (Math.abs(x - W / 2) < 50 || Math.abs(x - keepX) < 60 || ctx.isProtected(x, world.surface[x])) continue;
    buildSurfaceRuin(ctx, rng.fork('ruin' + i), x);
  }
  yield 0.45;

  // Underground cabins with depth-appropriate loot.
  const cabins = Math.floor(W / 110);
  for (let i = 0, placed = 0; i < cabins * 4 && placed < cabins; i++) {
    const x = rng.int(40, W - 60);
    const y = rng.int(L.undergroundY + 5, L.underworldY - 30);
    const loot = y < L.cavernY ? 'chest_underground' : y < L.deepY ? 'chest_cavern' : 'chest_deep';
    if (buildCabin(ctx, rng, x, y, loot)) placed++;
  }
  yield 0.6;

  for (const [cx, cy] of ctx.hollowCenters) buildShrine(ctx, rng, cx, cy);
  for (let i = 0; i < Math.max(3, Math.floor(W / 500)); i++) buildSpire(ctx, rng, rng.int(40, W - 60));
  yield 0.7;

  // Vital crystals.
  for (let i = 0, placed = 0; i < W && placed < Math.floor(W / 90); i++) {
    const x = rng.int(30, W - 30);
    const y = rng.int(L.undergroundY + 10, L.underworldY - 20);
    if (buildVitalChamber(ctx, rng, x, y)) placed++;
  }
  yield 0.8;

  // Urns and cobwebs on cave floors.
  const pot = T.pot;
  const web = TileRegistry.id('cobweb');
  const bone = TileRegistry.id('bone_pile');
  for (let i = 0; i < W * 6; i++) {
    const x = rng.int(5, W - 6);
    const y = rng.int(L.undergroundY, L.underworldY + 20);
    if (ctx.isProtected(x, y)) continue;
    if (!ctx.air(x, y) || !ctx.air(x + 1, y) || !ctx.air(x, y - 1) || !ctx.air(x + 1, y - 1)) continue;
    if (!ctx.solid(x, y + 1) || !ctx.solid(x + 1, y + 1) || world.getLiquid(x, y) > 0) continue;
    const r = rng.next();
    if (r < 0.25) ctx.placeObject(x, y - 1, 'pot');
    else if (r < 0.32) world.setFg(x, y, bone, 0);
    void pot;
  }
  for (let i = 0; i < W * 3; i++) {
    const x = rng.int(5, W - 6);
    const y = rng.int(L.undergroundY, L.underworldY);
    if (!ctx.air(x, y) || ctx.isProtected(x, y)) continue;
    const corner = (ctx.solid(x, y - 1) ? 1 : 0) + (ctx.solid(x - 1, y) ? 1 : 0) + (ctx.solid(x + 1, y) ? 1 : 0);
    if (corner >= 2 && rng.chance(0.4)) world.setFg(x, y, web, 0);
  }
  yield 1;
}
