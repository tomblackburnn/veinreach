import { describe, it, expect } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { unsealWorld } from '../src/systems/Unsealing';
import { TileRegistry } from '../src/world/TileRegistry';
import { unobtainableItems } from '../src/data/obtainability';
import { newCharacter } from '../src/core/playerSave';
import { defaultAppearance } from '../src/entities/player/Appearance';
import { ItemRegistry } from '../src/items/ItemRegistry';
import type { World } from '../src/world/World';

function countTiles(w: World, keys: string[]): Record<string, number> {
  const ids = keys.map((k) => TileRegistry.id(k));
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const c of w.chunks) for (const v of c.fg) { const i = ids.indexOf(v); if (i >= 0) out[keys[i]]++; }
  return out;
}

describe('world progression content', () => {
  it('every item in the game can be obtained', () => {
    const { world } = generateWorldSync({ name: 'audit', seed: 'audit', width: 2200, height: 620 });
    const tiles = new Set<number>();
    const walls = new Set<number>([TileRegistry.wallId('shard_wall')]);
    for (const c of world.chunks) {
      c.fg.forEach((v) => tiles.add(v));
      c.wall.forEach((v) => walls.add(v));
    }
    for (const k of ['umbralite_ore', 'aetherium_ore', 'shardgrass', 'shardrock', 'starshard_ore', 'basalt']) tiles.add(TileRegistry.id(k));
    const kit = newCharacter('x', defaultAppearance(), 'wanderer').inventory.main.filter(Boolean).map((s) => s!.id);
    expect(unobtainableItems({ naturalTiles: tiles, naturalWalls: walls, startingKit: kit, extra: ['wood', 'seedling', 'mushroom', 'leafthatch'] })).toEqual([]);
  });

  it('the Unsealing seeds Umbralite, Aetherium and the Shardblight, and they obey progression and pick tiers', () => {
    const g = generateWorldSync({ name: 'u', seed: 'unseal-test', width: 1400, height: 450 });
    const w = g.world;
    const keys = ['umbralite_ore', 'aetherium_ore', 'shardgrass', 'shardrock'];
    const before = countTiles(w, keys);
    expect(before.umbralite_ore + before.aetherium_ore).toBe(0);
    const ctx = new SimContext(w);
    // Locked before the Seal breaks.
    let umbral = [0, 0];
    const run = unsealWorld(ctx, 'unseal-test');
    for (let r = run.next(); !r.done; r = run.next());
    const after = countTiles(w, keys);
    expect(after.umbralite_ore).toBeGreaterThan(200);
    expect(after.aetherium_ore).toBeGreaterThan(100);
    expect(after.shardgrass + after.shardrock).toBeGreaterThan(500);
    // Ores sit below the cavern layer.
    const uid = TileRegistry.id('umbralite_ore');
    outer: for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (w.getFg(x, y) === uid) { umbral = [x, y]; break outer; }
    expect(umbral[1]).toBeGreaterThanOrEqual(w.layers.cavernY - 2);
    const [ux, uy] = umbral;
    expect(ctx.mining.hitTile(ctx, ux, uy, 100, 'pick', 0)).toBe('locked');
    ctx.progression.set('unsealed');
    expect(ctx.mining.hitTile(ctx, ux, uy, 80, 'pick', 0)).toBe('weak');
    expect(['hit', 'broke']).toContain(ctx.mining.hitTile(ctx, ux, uy, ItemRegistry.get('cindrite_pickaxe').tool!.pick!, 'pick', 0));
    // Aetherium needs the Umbral pickaxe (crafted from Umbralite).
    const aid = TileRegistry.id('aetherium_ore');
    let a: [number, number] | null = null;
    outer2: for (let y = 0; y < w.height; y++) for (let x = 0; x < w.width; x++) if (w.getFg(x, y) === aid) { a = [x, y]; break outer2; }
    expect(ctx.mining.hitTile(ctx, a![0], a![1], ItemRegistry.get('cindrite_pickaxe').tool!.pick!, 'pick', 0)).toBe('weak');
    expect(['hit', 'broke']).toContain(ctx.mining.hitTile(ctx, a![0], a![1], ItemRegistry.get('umbral_pickaxe').tool!.pick!, 'pick', 0));
  });

  it('the Unsealing is deterministic for a seed', () => {
    const run = (seed: string) => {
      const g = generateWorldSync({ name: 'u', seed, width: 700, height: 360 });
      const it = unsealWorld(new SimContext(g.world), seed);
      for (let r = it.next(); !r.done; r = it.next());
      return countTiles(g.world, ['umbralite_ore', 'aetherium_ore', 'shardgrass']);
    };
    expect(run('same')).toEqual(run('same'));
  });

  it('each pickaxe tier can mine the next ore tier', () => {
    const tiers: [string, string][] = [
      ['brasslite_pickaxe', 'hushstone'],
      ['ferrocite_pickaxe', 'moonsilver_ore'],
      ['moonsilver_pickaxe', 'sungild_ore'],
      ['sungild_pickaxe', 'glimmerite_ore'],
      ['glimmer_pickaxe', 'cindrite_ore'],
      ['cindrite_pickaxe', 'umbralite_ore'],
      ['umbral_pickaxe', 'aetherium_ore'],
    ];
    for (const [pick, ore] of tiers) {
      expect(ItemRegistry.get(pick).tool!.pick!, `${pick} -> ${ore}`).toBeGreaterThanOrEqual(TileRegistry.get(TileRegistry.id(ore)).toolPower);
    }
  });
});
