import { describe, it, expect } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { T } from '../src/world/TileRegistry';

function hashWorld(w: ReturnType<typeof generateWorldSync>['world']): number {
  let h = 2166136261;
  for (const c of w.chunks) {
    for (let i = 0; i < c.fg.length; i += 3) {
      h ^= c.fg[i] * 31 + c.wall[i] * 7 + c.liquid[i];
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

describe('world generation', () => {
  const opts = { name: 'Test', seed: 'determinism', width: 600, height: 320 };

  it('is deterministic for the same seed', () => {
    const a = generateWorldSync(opts);
    const b = generateWorldSync(opts);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    expect(a.spawnX).toBe(b.spawnX);
    expect(a.world.chests.size).toBe(b.world.chests.size);
  });

  it('differs between seeds', () => {
    const a = generateWorldSync(opts);
    const b = generateWorldSync({ ...opts, seed: 'another' });
    expect(hashWorld(a.world)).not.toBe(hashWorld(b.world));
  });

  it('produces a sensible world', () => {
    const { world, spawnX, spawnY, structures } = generateWorldSync(opts);
    // Spawn stands on solid ground with air above.
    expect(world.isSolid(spawnX, spawnY + 1)).toBe(true);
    expect(world.getFg(spawnX, spawnY)).toBe(0);
    // Has caves, ore, chests, structures.
    let air = 0;
    let ore = 0;
    for (let y = world.layers.undergroundY; y < world.layers.underworldY; y++) {
      for (let x = 0; x < world.width; x++) {
        const id = world.getFg(x, y);
        if (id === 0) air++;
        if (id === 18 || id === 19) ore++;
      }
    }
    expect(air).toBeGreaterThan(1000);
    expect(ore).toBeGreaterThan(50);
    expect(world.chests.size).toBeGreaterThan(3);
    expect(structures.some((s) => s.kind === 'keep')).toBe(true);
    expect(world.getFg(spawnX, spawnY + 1)).not.toBe(T.air);
    // Nothing modified after generation.
    expect(world.modifiedChunks().length).toBe(0);
  });
});
