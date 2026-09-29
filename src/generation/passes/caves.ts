import type { GenContext } from '../GenContext';
import { T } from '../../world/TileRegistry';
import { clamp } from '../../utils/math';

/**
 * Cave carving combines three techniques:
 *  1. ridged-noise tunnel networks (long connected passages)
 *  2. low-frequency fbm "chambers" (big open caverns, more common with depth)
 *  3. random-walk worms (surface entrances and extra connectors)
 * followed by a cellular-automata cleanup that removes floating specks.
 */
export function* carveCaves(ctx: GenContext): Generator<number> {
  const { W, world, noise, noise2, noise3 } = ctx;
  const L = world.layers;
  const top = L.surfaceY - 10;
  const bottom = L.underworldY - 6;

  for (let y = top; y < bottom; y++) {
    const depthT = clamp((y - L.undergroundY) / (L.deepY - L.undergroundY), 0, 1);
    const tunnelThresh = 0.9 - depthT * 0.035;
    const chamberThresh = 0.42 - depthT * 0.14;
    for (let x = 2; x < W - 2; x++) {
      const surf = world.surface[x];
      if (y < surf + 12) continue; // keep the crust intact; worms make entrances
      if (world.getFg(x, y) === 0) continue;
      const r = noise.ridged(x * 0.018, y * 0.03, 2);
      let carve = r > tunnelThresh;
      if (!carve && y > L.undergroundY) {
        const c = noise2.fbm(x * 0.012, y * 0.02, 3);
        carve = c > chamberThresh + (y < L.cavernY ? 0.08 : 0);
      }
      if (!carve && y > L.cavernY) {
        // Secondary sparse tunnels in a different orientation.
        carve = noise3.ridged(x * 0.03 + 100, y * 0.02, 2) > 0.93;
      }
      if (carve) world.setFg(x, y, 0, 0);
    }
    if ((y & 15) === 0) yield ((y - top) / (bottom - top)) * 0.6;
  }

  const rng = ctx.passRng('worms');
  // Surface entrances.
  const entrances = Math.floor(W / 140);
  for (let i = 0; i < entrances; i++) {
    const x = rng.int(80, W - 80);
    if (Math.abs(x - W / 2) < 40) continue;
    const y = world.surface[x] - 2;
    ctx.worm(x, y, Math.PI / 2 + rng.range(-0.4, 0.4), rng.int(60, 160), rng.range(2, 3.4), rng, { wander: 0.25, down: 0.02, removeWalls: y < L.undergroundY });
  }
  yield 0.7;
  // Deep connectors.
  const count = Math.floor((W * ctx.H) / 9000);
  for (let i = 0; i < count; i++) {
    const x = rng.int(20, W - 20);
    const y = rng.int(L.undergroundY, L.underworldY - 20);
    ctx.worm(x, y, rng.range(0, Math.PI * 2), rng.int(30, 110), rng.range(1.3, 3.2), rng, { wander: 0.4 });
  }
  yield 0.85;
  cellularCleanup(ctx, top, bottom);
  yield 1;
}

/** One CA pass: remove solid specks surrounded by air, fill tiny air pockets. */
export function cellularCleanup(ctx: GenContext, top: number, bottom: number, x0 = 1, x1 = ctx.W - 1): void {
  const { world } = ctx;
  const toClear: number[] = [];
  const toFill: number[] = [];
  for (let y = top + 1; y < bottom - 1; y++) {
    for (let x = x0 + 1; x < x1 - 1; x++) {
      let solidN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx || dy) && world.isSolid(x + dx, y + dy)) solidN++;
        }
      }
      const s = world.isSolid(x, y);
      if (s && solidN <= 2) toClear.push(x, y);
      else if (!s && solidN >= 7 && world.getFg(x, y) === 0 && y > world.surface[x] + 3) toFill.push(x, y);
    }
  }
  for (let i = 0; i < toClear.length; i += 2) world.setFg(toClear[i], toClear[i + 1], 0, 0);
  for (let i = 0; i < toFill.length; i += 2) {
    const x = toFill[i];
    const y = toFill[i + 1];
    world.setFg(x, y, y > world.layers.deepY ? T.hushstone : T.stone, 0);
  }
}
