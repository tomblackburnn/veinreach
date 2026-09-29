import type { GenContext } from '../GenContext';
import { T, TileRegistry, LIQUID } from '../../world/TileRegistry';
import { SURFACE_BIOME_ORDER } from '../../biomes/BiomeDetector';
import type { BiomeKey } from '../../data/biomes';
import { smoothstep, clamp } from '../../utils/math';

const B = (k: BiomeKey) => SURFACE_BIOME_ORDER.indexOf(k);

/** Lay out surface biome columns: shore | ... | meadow(spawn) | ... | shore. */
export function* layoutBiomes(ctx: GenContext): Generator<number> {
  const rng = ctx.passRng('biomes');
  const W = ctx.W;
  const col = ctx.world.biomeColumn;
  col.fill(B('meadow'));
  const shore = Math.floor(W * 0.035) + 20;
  for (let x = 0; x < shore; x++) {
    col[x] = B('shore');
    col[W - 1 - x] = B('shore');
  }
  const spawnHalf = Math.floor(W * 0.07);
  const center = Math.floor(W / 2);
  // Split each side into slots; place dunes/taiga on opposite sides, blightmire on a random side.
  const duneLeft = rng.chance(0.5);
  const blightLeft = rng.chance(0.5);
  ctx.keepSide = blightLeft ? 1 : -1;
  const place = (key: BiomeKey, left: boolean, frac0: number, frac1: number) => {
    // frac measured from the spawn edge outward to the shore.
    const inner = center + (left ? -spawnHalf : spawnHalf);
    const outer = left ? shore : W - shore;
    const span = Math.abs(outer - inner);
    const a = inner + (left ? -1 : 1) * Math.floor(span * frac0);
    const b = inner + (left ? -1 : 1) * Math.floor(span * frac1);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let x = lo; x < hi; x++) col[x] = B(key);
  };
  // Blightmire shares its side with one of dunes/taiga; place it further out when shared.
  place('dunes', duneLeft, rng.range(0.1, 0.2), rng.range(0.42, 0.5));
  place('taiga', !duneLeft, rng.range(0.08, 0.18), rng.range(0.42, 0.5));
  place('blightmire', blightLeft, rng.range(0.6, 0.64), rng.range(0.8, 0.86));
  yield 1;
}

/** Heightmap + base material fill + natural walls. */
export function* shapeTerrain(ctx: GenContext): Generator<number> {
  const { W, H, world, noise, noise2 } = ctx;
  const L = world.layers;
  const col = world.biomeColumn;

  // Per-biome amplitude profiles, smoothed across boundaries.
  const amp = new Float32Array(W);
  const offs = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    switch (col[x]) {
      case B('taiga'): amp[x] = 1.5; offs[x] = -8; break;
      case B('dunes'): amp[x] = 0.9; offs[x] = 2; break;
      case B('blightmire'): amp[x] = 0.5; offs[x] = 6; break;
      case B('shore'): amp[x] = 0.3; offs[x] = 4; break;
      default: amp[x] = 1; offs[x] = 0;
    }
  }
  const smoothArr = (arr: Float32Array, rad: number) => {
    const out = new Float32Array(arr.length);
    let sum = 0;
    for (let x = -rad; x <= rad; x++) sum += arr[clamp(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      out[x] = sum / (rad * 2 + 1);
      sum += arr[clamp(x + rad + 1, 0, W - 1)] - arr[clamp(x - rad, 0, W - 1)];
    }
    return out;
  };
  const sAmp = smoothArr(amp, 24);
  const sOffs = smoothArr(offs, 24);

  const base = L.surfaceY;
  const shoreW = Math.floor(W * 0.035) + 20;
  ctx.seaLevel = base + 6;
  for (let x = 0; x < W; x++) {
    let h =
      base +
      sOffs[x] +
      noise.fbm(x * 0.004, 0.3, 4) * 42 * sAmp[x] +
      noise2.fbm(x * 0.025, 1.7, 3) * 9 * sAmp[x];
    if (col[x] === B('dunes')) h += Math.sin(x * 0.045 + noise.perlin1(x * 0.01) * 3) * 4;
    // Ocean basins at both edges.
    const edge = Math.min(x, W - 1 - x);
    if (edge < shoreW + 30) {
      const t = smoothstep(clamp(1 - (edge - 8) / (shoreW + 22), 0, 1));
      h = h * (1 - t) + (ctx.seaLevel + 34) * t;
    }
    world.surface[x] = Math.round(clamp(h, 30, L.undergroundY + 10));
  }
  yield 0.2;

  const dirtLayerNoise = (x: number) => 9 + noise2.perlin1(x * 0.05) * 4;
  for (let x = 0; x < W; x++) {
    const surf = world.surface[x];
    const biome = col[x];
    const soilDepth = dirtLayerNoise(x);
    const stoneTransition = L.undergroundY + noise.perlin2(x * 0.02, 9.1) * 8;
    const deepTransition = L.deepY + noise.perlin2(x * 0.02, 19.3) * 12;
    for (let y = surf; y < H; y++) {
      const d = y - surf;
      let id: number;
      if (y >= L.underworldY - 4 + noise2.perlin2(x * 0.04, 3) * 6) {
        id = T.ash;
      } else if (y >= deepTransition) {
        id = noise.perlin2(x * 0.05, y * 0.05) > 0.25 ? T.stone : T.hushstone;
      } else if (d < soilDepth) {
        id = biome === B('dunes') || biome === B('shore') ? T.sand : biome === B('taiga') ? T.snow : T.loam;
      } else if (y < stoneTransition) {
        id = biome === B('dunes') ? (d < soilDepth + 14 ? T.sand : T.sandstone) : biome === B('taiga') ? T.snow : T.loam;
      } else {
        id = T.stone;
      }
      world.setFg(x, y, id, 0);
    }
    if ((x & 63) === 0) yield 0.2 + (x / W) * 0.4;
  }

  // Mixed patches: loam in stone, stone in loam, clay, gravel.
  const n3 = ctx.noise3;
  for (let y = L.surfaceY - 30; y < L.underworldY - 10; y++) {
    for (let x = 0; x < W; x++) {
      const id = world.getFg(x, y);
      if (id === 0) continue;
      const v = n3.fbm(x * 0.06, y * 0.06, 2);
      if (id === T.stone && y < L.cavernY + 30 && v > 0.38) world.setFg(x, y, T.loam, 0);
      else if (id === T.loam && y > world.surface[x] + 6 && v < -0.42) world.setFg(x, y, T.stone, 0);
      else if (id === T.loam && y < L.undergroundY && n3.perlin2(x * 0.09 + 50, y * 0.09) > 0.55) world.setFg(x, y, T.clay, 0);
      else if (id === T.stone && y > L.cavernY && n3.perlin2(x * 0.08, y * 0.08 + 70) > 0.6) world.setFg(x, y, TileRegistry.id('gravel'), 0);
    }
    if ((y & 31) === 0) yield 0.6 + ((y - L.surfaceY) / (L.underworldY - L.surfaceY)) * 0.25;
  }

  // Oceans: fill water up to sea level.
  for (let x = 0; x < W; x++) {
    if (col[x] !== B('shore')) continue;
    for (let y = ctx.seaLevel; y < world.surface[x]; y++) {
      if (world.getFg(x, y) === 0) world.setLiquid(x, y, 255, LIQUID.water);
    }
  }
  yield 0.9;
  placeNaturalWalls(ctx);
  yield 1;
}

function placeNaturalWalls(ctx: GenContext): void {
  const { W, world } = ctx;
  const L = world.layers;
  const col = world.biomeColumn;
  const w = (k: string) => TileRegistry.wallId(k);
  const loamW = w('loam_wall');
  const stoneW = w('stone_wall');
  const sandW = w('sandstone_wall');
  const rimeW = w('rime_wall');
  const blightW = w('blight_wall');
  const hushW = w('hush_wall');
  const ashW = w('ash_wall');
  for (let x = 0; x < W; x++) {
    const start = world.surface[x] + 4 + Math.floor(ctx.noise.perlin2(x * 0.1, 5) * 2);
    const biome = col[x];
    for (let y = start; y < ctx.H; y++) {
      let id: number;
      if (y >= L.underworldY) id = ashW;
      else if (y >= L.deepY) id = hushW;
      else if (biome === B('dunes') && y < L.cavernY) id = sandW;
      else if (biome === B('taiga') && y < L.cavernY) id = rimeW;
      else if (biome === B('blightmire') && y < L.cavernY) id = blightW;
      else if (y < L.undergroundY + 6) id = loamW;
      else id = stoneW;
      world.setWall(x, y, id);
    }
  }
}
