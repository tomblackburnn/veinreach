import { GenContext, type GenOptions } from './GenContext';
import { layoutBiomes, shapeTerrain } from './passes/terrain';
import { carveCaves } from './passes/caves';
import { emberdeep, glimmerHollows, ores, sporeglow, surfaceBiomeDepths, undergroundLiquids } from './passes/biomeRegions';
import { placeStructures } from './passes/structures';
import { vegetation } from './passes/vegetation';
import type { World } from '../world/World';
import type { StructureInfo } from '../world/WorldState';

export interface GenProgress {
  stage: string;
  progress: number;
}

export interface GeneratedWorld {
  world: World;
  spawnX: number;
  spawnY: number;
  structures: StructureInfo[];
}

type Pass = [string, (ctx: GenContext) => Generator<number>, number];

const PASSES: Pass[] = [
  ['Charting the lands', layoutBiomes, 1],
  ['Raising hills and valleys', shapeTerrain, 8],
  ['Hollowing out caves', carveCaves, 10],
  ['Shaping biomes', surfaceBiomeDepths, 3],
  ['Growing the Sporeglow', sporeglow, 2],
  ['Crystallising the Hollows', glimmerHollows, 2],
  ['Kindling Emberdeep', emberdeep, 4],
  ['Seeding ore veins', ores, 3],
  ['Pooling water and magma', undergroundLiquids, 2],
  ['Raising ruins and keeps', placeStructures, 4],
  ['Planting forests', vegetation, 5],
];

/**
 * Deterministic world generation as a generator function so the caller can
 * time-slice it (keeping the UI responsive) and report progress.
 */
export function* generateWorld(opts: GenOptions): Generator<GenProgress, GeneratedWorld> {
  const ctx = new GenContext(opts);
  const total = PASSES.reduce((s, p) => s + p[2], 0);
  let done = 0;
  for (const [stage, pass, weight] of PASSES) {
    yield { stage, progress: done / total };
    for (const p of pass(ctx)) yield { stage, progress: (done + p * weight) / total };
    done += weight;
  }
  yield { stage: 'Settling the world', progress: 0.99 };
  const world = ctx.world;
  // Spawn point: the centre column's surface.
  const sx = Math.floor(ctx.W / 2);
  let sy = 0;
  while (sy < ctx.H - 1 && !world.isSolid(sx, sy)) sy++;
  // Keep the spawn area clear of trees/plants.
  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = 1; dy < 20; dy++) {
      const id = world.getFg(sx + dx, sy - dy);
      if (id !== 0 && !world.isSolid(sx + dx, sy - dy)) world.setFg(sx + dx, sy - dy, 0, 0);
    }
  }
  ctx.spawnX = sx;
  ctx.spawnY = sy - 1;
  world.recomputeSkyTop();
  world.structures = ctx.structures;
  for (const c of world.chunks) {
    c.modified = false;
    c.renderDirty = true;
  }
  world.generating = false;
  return { world, spawnX: ctx.spawnX, spawnY: ctx.spawnY, structures: ctx.structures };
}

/** Run a generator to completion synchronously (tests, server). */
export function generateWorldSync(opts: GenOptions): GeneratedWorld {
  const gen = generateWorld(opts);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/** Yield to the event loop without setTimeout's 4 ms clamp / background-tab throttling. */
function nextTask(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0));
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(0);
  });
}

/** Run a generator in time slices, reporting progress. */
export function runSliced<T>(gen: Generator<GenProgress, T>, onProgress: (p: GenProgress) => void, budgetMs = 14): Promise<T> {
  return new Promise((resolve, reject) => {
    const step = () => {
      const start = performance.now();
      try {
        let last: GenProgress | null = null;
        while (performance.now() - start < budgetMs) {
          const r = gen.next();
          if (r.done) {
            if (last) onProgress(last);
            resolve(r.value);
            return;
          }
          last = r.value;
        }
        if (last) onProgress(last);
        void nextTask().then(step);
      } catch (err) {
        reject(err);
      }
    };
    void nextTask().then(step);
  });
}
