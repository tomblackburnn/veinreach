import { tileSet, type GenContext } from '../GenContext';
import { T, TileRegistry, LIQUID } from '../../world/TileRegistry';
import { SURFACE_BIOME_ORDER } from '../../biomes/BiomeDetector';
import { cellularCleanup } from './caves';
import { Rng } from '../../utils/random';

const colIs = (ctx: GenContext, x: number, key: string) => SURFACE_BIOME_ORDER[ctx.world.biomeColumn[x]] === key;

/** Underground extensions of surface biomes, plus the chasms of the Blightmire. */
export function* surfaceBiomeDepths(ctx: GenContext): Generator<number> {
  const { W, world, noise } = ctx;
  const L = world.layers;
  for (let x = 0; x < W; x++) {
    for (let y = world.surface[x]; y < L.deepY; y++) {
      // Jitter the column lookup so biome borders underground are ragged, and taper with depth.
      const depthT = (y - world.surface[x]) / (L.deepY - world.surface[x]);
      const jitter = Math.round(noise.perlin2(x * 0.03, y * 0.03) * 16 + (x < W / 2 ? 1 : -1) * depthT * 10);
      const bx = Math.max(0, Math.min(W - 1, x + jitter));
      const dunes = colIs(ctx, bx, 'dunes');
      const taiga = colIs(ctx, bx, 'taiga');
      const blight = colIs(ctx, bx, 'blightmire');
      if (!dunes && !taiga && !blight) continue;
      const limit = (dunes ? L.cavernY + 30 : blight ? L.cavernY : L.deepY - 10) + noise.perlin2(x * 0.03, 40) * 15;
      if (y >= limit) continue;
      const id = world.getFg(x, y);
      if (id === 0) continue;
      if (dunes) {
        if (id === T.stone || id === T.loam || id === T.clay) world.setFg(x, y, noise.perlin2(x * 0.07, y * 0.07) > 0.3 ? T.sand : T.sandstone, 0);
      } else if (taiga) {
        if (id === T.stone) world.setFg(x, y, noise.perlin2(x * 0.06, y * 0.06 + 30) > 0.05 ? T.ice : T.stone, 0);
        else if (id === T.loam || id === T.clay) world.setFg(x, y, T.snow, 0);
      } else if (blight) {
        if (id === T.stone) world.setFg(x, y, T.blightrock, 0);
      }
    }
    if ((x & 127) === 0) yield (x / W) * 0.6;
  }

  // Blightmire chasms: narrow vertical shafts lined with blightrock.
  const rng = ctx.passRng('chasms');
  const blightCols: number[] = [];
  for (let x = 0; x < W; x++) if (colIs(ctx, x, 'blightmire')) blightCols.push(x);
  if (blightCols.length) {
    const n = 3 + Math.floor(blightCols.length / 70);
    for (let i = 0; i < n; i++) {
      let x = rng.pick(blightCols);
      const depth = rng.int(50, L.cavernY - world.surface[x] + 20);
      let width = rng.range(2, 4);
      for (let d = -3; d < depth; d++) {
        const y = world.surface[x] + d;
        for (let dx = -Math.ceil(width) - 2; dx <= Math.ceil(width) + 2; dx++) {
          const px = Math.round(x + dx);
          if (!ctx.inside(px, y, 2)) continue;
          if (Math.abs(dx) <= width) {
            world.setFg(px, y, 0, 0);
            if (d < 8) world.setWall(px, y, 0);
          } else if (world.getFg(px, y) !== 0) world.setFg(px, y, T.blightrock, 0);
        }
        x += rng.range(-0.6, 0.6);
        width = Math.max(1.5, Math.min(5, width + rng.range(-0.3, 0.3)));
      }
    }
  }
  yield 1;
}

/** Sporeglow Caverns: mud-filled fungal groves in the cavern layer. */
export function* sporeglow(ctx: GenContext): Generator<number> {
  const { W, world, noise } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('sporeglow');
  const count = W > 3000 ? 3 : 2;
  const mudW = TileRegistry.wallId('mud_wall');
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const cx = Math.floor(W / 2 + side * rng.range(W * 0.12, W * 0.32));
    const cy = Math.floor(rng.range(L.cavernY + 10, L.deepY - 10));
    const rx = rng.range(W * 0.035, W * 0.05) + 25;
    const ry = rng.range(30, 45);
    ctx.sporeglowCenters.push([cx, cy]);
    for (let y = Math.floor(cy - ry - 6); y < cy + ry + 6; y++) {
      for (let x = Math.floor(cx - rx - 6); x < cx + rx + 6; x++) {
        if (!ctx.inside(x, y, 2)) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy + noise.perlin2(x * 0.05, y * 0.05) * 0.3;
        if (d > 1) continue;
        const id = world.getFg(x, y);
        // Open the grove up a little more than regular caves.
        const open = noise.fbm(x * 0.03 + 300, y * 0.05, 2) > 0.05;
        if (open && d < 0.85) world.setFg(x, y, 0, 0);
        else if (id !== 0) world.setFg(x, y, T.mud, 0);
        world.setWall(x, y, mudW);
      }
    }
    yield (i + 1) / count;
  }
}

/** Glimmer Hollows: cellular-automata crystal caverns in the deep layer. */
export function* glimmerHollows(ctx: GenContext): Generator<number> {
  const { W, world } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('hollows');
  const count = Math.max(3, Math.floor(W / 500));
  const prismW = TileRegistry.wallId('prism_wall');
  const glim = TileRegistry.id('glimmerite_ore');
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng.range(W * 0.08, W * 0.92));
    const cy = Math.floor(rng.range(L.deepY + 10, L.underworldY - 45));
    const hw = rng.int(28, 42);
    const hh = rng.int(20, 28);
    ctx.hollowCenters.push([cx, cy]);
    const x0 = cx - hw;
    const y0 = cy - hh;
    const gw = hw * 2;
    const gh = hh * 2;
    // Random fill inside ellipse then smooth with CA rules (B5678/S45678 variant).
    let grid = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const dx = (x - hw) / hw;
        const dy = (y - hh) / hh;
        const inside = dx * dx + dy * dy < 1;
        grid[y * gw + x] = !inside || rng.chance(0.46) ? 1 : 0;
      }
    }
    for (let it = 0; it < 5; it++) {
      const next = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const xx = x + dx;
              const yy = y + dy;
              n += xx < 0 || yy < 0 || xx >= gw || yy >= gh ? 1 : grid[yy * gw + xx];
            }
          }
          next[y * gw + x] = n >= 5 || (grid[y * gw + x] && n >= 4) ? 1 : 0;
        }
      }
      grid = next;
    }
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const wx = x0 + x;
        const wy = y0 + y;
        if (!ctx.inside(wx, wy, 2)) continue;
        const dx = (x - hw) / (hw + 4);
        const dy = (y - hh) / (hh + 4);
        if (dx * dx + dy * dy > 1.1) continue;
        world.setWall(wx, wy, prismW);
        if (grid[y * gw + x]) {
          if (world.getFg(wx, wy) !== 0 || dx * dx + dy * dy < 1) world.setFg(wx, wy, rng.chance(0.03) ? glim : T.prismstone, 0);
        } else {
          world.setFg(wx, wy, 0, 0);
        }
      }
    }
    // Glimmerite veins.
    for (let v = 0; v < 10; v++) {
      let vx = cx + rng.int(-hw, hw);
      let vy = cy + rng.int(-hh, hh);
      for (let s = 0; s < 8; s++) {
        ctx.blob(vx, vy, rng.range(0.8, 1.6), glim, new Set([T.prismstone]));
        vx += rng.int(-1, 1);
        vy += rng.int(-1, 1);
      }
    }
    yield (i + 1) / count;
  }
}

/** Emberdeep: the molten underworld band at the bottom of the map. */
export function* emberdeep(ctx: GenContext): Generator<number> {
  const { W, H, world, noise, noise2 } = ctx;
  const L = world.layers;
  const top = L.underworldY;
  const ceilBase = top + 12;
  const floorBase = H - 26;
  const magma = TileRegistry.id('magmarock');
  const cindrite = TileRegistry.id('cindrite_ore');
  const ashW = TileRegistry.wallId('ash_wall');
  for (let x = 0; x < W; x++) {
    const ceil = ceilBase + noise.fbm(x * 0.02, 77, 3) * 10;
    const floor = floorBase + noise2.fbm(x * 0.015, 11, 3) * 12;
    for (let y = top - 6; y < H; y++) {
      if (y >= H - 3) {
        world.setFg(x, y, T.basalt, 0);
        continue;
      }
      if (y > ceil && y < floor) {
        world.setFg(x, y, 0, 0);
        world.setWall(x, y, noise.perlin2(x * 0.05, y * 0.05) > 0.2 ? ashW : 0);
      } else if (world.getFg(x, y) !== 0 || y > top) {
        const v = noise2.perlin2(x * 0.08, y * 0.08);
        world.setFg(x, y, v > 0.45 ? magma : T.ash, 0);
      }
    }
    if ((x & 127) === 0) yield (x / W) * 0.6;
  }
  // Floating ash islands to make traversal interesting.
  const rng = ctx.passRng('ember');
  for (let i = 0; i < W / 60; i++) {
    const x = rng.int(10, W - 10);
    const y = rng.int(ceilBase + 10, floorBase - 10);
    for (let k = 0; k < 6; k++) ctx.blob(x + rng.int(-6, 6), y + rng.int(-2, 2), rng.range(2, 4), T.ash, new Set([0]));
  }
  // Lava lakes on the floor.
  for (let x = 2; x < W - 2; x++) {
    let y = floorBase - 14;
    while (y < H - 3 && world.getFg(x, y) === 0) y++;
    const lavaLevel = floorBase - 3;
    for (let yy = lavaLevel; yy < y; yy++) world.setLiquid(x, yy, 255, LIQUID.lava);
  }
  // Cindrite ore.
  const hosts = new Set([T.ash, magma]);
  for (let i = 0; i < W / 14; i++) {
    let x = rng.int(4, W - 4);
    let y = rng.int(top, H - 4);
    for (let s = 0; s < 6; s++) {
      ctx.blob(x, y, rng.range(0.8, 1.8), cindrite, hosts);
      x += rng.int(-1, 1);
      y += rng.int(-1, 1);
    }
  }
  cellularCleanup(ctx, top - 4, H - 3);
  yield 1;
}

/** Lava pockets & underground water lakes. */
export function* undergroundLiquids(ctx: GenContext): Generator<number> {
  const { W, world } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('liquids');
  const attempts = Math.floor((W * (L.underworldY - L.undergroundY)) / 2500);
  for (let i = 0; i < attempts; i++) {
    const x = rng.int(10, W - 10);
    const y = rng.int(L.undergroundY, L.underworldY - 10);
    if (!ctx.air(x, y)) continue;
    const lava = y > L.deepY && rng.chance(0.35);
    ctx.fillBasin(x, y, rng.int(3, lava ? 5 : 9), lava ? LIQUID.lava : LIQUID.water);
    if ((i & 63) === 0) yield i / attempts;
  }
  // Surface ponds in Mossmeadow & Blightmire.
  for (let i = 0; i < Math.floor(W / 500) + 1; i++) {
    const x = rng.int(Math.floor(W * 0.15), Math.floor(W * 0.85));
    if (Math.abs(x - W / 2) < 60) continue;
    if (!colIs(ctx, x, 'meadow') && !colIs(ctx, x, 'blightmire')) continue;
    const surf = world.surface[x];
    const rw = rng.int(8, 14);
    const depth = rng.int(4, 7);
    for (let dx = -rw; dx <= rw; dx++) {
      const d = Math.floor(depth * Math.sqrt(1 - (dx * dx) / (rw * rw)));
      for (let dy = 0; dy < d; dy++) world.setFg(x + dx, surf + dy, 0, 0);
    }
    ctx.fillBasin(x, surf, depth + 1);
  }
  yield 1;
}

export const ORE_HOSTS = () => tileSet('stone', 'hushstone', 'loam', 'clay', 'ice', 'sandstone', 'blightrock', 'snow', 'mud');

/** Ore veins: clustered random walks within depth bands. */
export function* ores(ctx: GenContext): Generator<number> {
  const { W, H, world } = ctx;
  const L = world.layers;
  const rng = ctx.passRng('ores');
  const hosts = ORE_HOSTS();
  const scale = (W * H) / 1_000_000;
  const defs: { key: string; min: number; max: number; count: number; size: [number, number]; r: [number, number] }[] = [
    { key: 'soot_seam', min: L.surfaceY, max: L.cavernY + 40, count: 320, size: [4, 10], r: [0.8, 1.8] },
    { key: 'brasslite_ore', min: L.surfaceY + 5, max: L.cavernY + 60, count: 380, size: [4, 9], r: [0.8, 1.6] },
    { key: 'ferrocite_ore', min: L.undergroundY, max: L.deepY + 30, count: 300, size: [4, 9], r: [0.8, 1.6] },
    { key: 'moonsilver_ore', min: L.cavernY - 20, max: L.underworldY - 10, count: 220, size: [3, 8], r: [0.8, 1.5] },
    { key: 'sungild_ore', min: L.deepY - 30, max: L.underworldY - 8, count: 170, size: [3, 7], r: [0.8, 1.4] },
    { key: 'clay', min: L.surfaceY, max: L.cavernY, count: 120, size: [4, 10], r: [1.5, 2.5] },
    { key: 'sand', min: L.undergroundY, max: L.deepY, count: 90, size: [3, 8], r: [1.5, 2.5] },
    { key: 'mud', min: L.cavernY, max: L.deepY + 40, count: 60, size: [3, 8], r: [1.5, 3] },
  ];
  defs.forEach((d, di) => {
    const id = TileRegistry.id(d.key);
    const n = Math.floor(d.count * scale);
    for (let i = 0; i < n; i++) placeVein(ctx, rng, id, hosts, rng.int(4, W - 4), rng.int(d.min, d.max), rng.int(d.size[0], d.size[1]), d.r);
    void di;
  });
  yield 1;
}

export function placeVein(ctx: GenContext, rng: Rng, id: number, hosts: Set<number>, x: number, y: number, steps: number, r: [number, number]): void {
  for (let s = 0; s < steps; s++) {
    ctx.blob(x, y, rng.range(r[0], r[1]), id, hosts);
    x += rng.int(-1, 1);
    y += rng.int(-1, 1);
  }
}
