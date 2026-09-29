import { describe, it, expect, vi } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { checkRoom, comfortTier, BLOOM_BONUS, PAINTING_BONUS } from '../src/world/housing';
import { TileRegistry } from '../src/world/TileRegistry';
import { placeObjectRaw } from '../src/world/objects';
import { buildNpcHouse, HOUSE_W, HOUSE_H } from '../src/world/prefabs';
import { canPlace, breakTile, breakWall } from '../src/world/WorldActions';
import { interactPlanter, growPlanter, planterFrame } from '../src/world/decor';
import { sanitizePainting, canvasArtSize, applyRemotePainting, blankArt } from '../src/world/paintings';
import { validateWorldRecord } from '../src/save/validation';
import { defaultWorldState } from '../src/world/WorldState';
import { NPC } from '../src/entities/npcs/NPC';
import { NPC_MAP } from '../src/data/npcs';
import { RecipeRegistry } from '../src/crafting/RecipeRegistry';
import { ItemRegistry } from '../src/items/ItemRegistry';
import { ObjectSprites } from '../src/rendering/sprites/objectSprites';
import { ANIMATED_DECOR } from '../src/rendering/DecorRenderer';

const id = (k: string) => TileRegistry.id(k);

describe('Hearth & Home decor', () => {
  const g = generateWorldSync({ name: 'decor', seed: 'decor-town', width: 420, height: 260 });
  const w = g.world;
  const ctx = new SimContext(w);

  const used: number[] = [];
  /** Build a fresh Housing Deed house near `near` (skipping occupied spots); returns its geometry. */
  function house(near: number) {
    let cx = near;
    let fy = 0;
    for (let tries = 0; ; tries++, cx += 17) {
      expect(tries).toBeLessThan(20);
      if (used.some((u) => Math.abs(u - cx) < HOUSE_W + 2)) continue;
      fy = 0;
      while (!w.isSolid(cx, fy)) fy++;
      if (buildNpcHouse(ctx, cx, fy) === null) break;
    }
    used.push(cx);
    const x0 = cx - Math.floor(HOUSE_W / 2);
    const top = fy - HOUSE_H + 1;
    return { x0, top, floor: fy, ix: x0 + 3, iy: fy - 1 };
  }

  it('every decoration is craftable at the Artisan’s Bench and has a sprite', () => {
    const decor = ['wind_chime', 'weathervane', 'pennant', 'hanging_lantern', 'wisp_jar', 'fountain', 'gloop_lamp', 'hourglass', 'orrery', 'planter', 'canvas_small', 'canvas_wide', 'rug'];
    for (const item of [...decor, 'rose_glass', 'amber_glass', 'verdant_glass', 'azure_glass', 'violet_glass', 'prism_glass']) {
      expect(RecipeRegistry.forOutput(item)[0]?.station, item).toBe('artisan');
      expect(ItemRegistry.get(item).placeTile, item).toBeTruthy();
    }
    expect(RecipeRegistry.forOutput('artisan_bench')[0].station).toBe('workbench');
    for (const key of [...decor, 'artisan_bench']) expect(ObjectSprites.has(key), key).toBe(true);
    for (const key of ANIMATED_DECOR) expect(TileRegistry.tryId(key), key).toBeDefined();
  });

  it('scores comfort by variety, counts windows, and awards bloom and painting bonuses', () => {
    const h = house(g.spawnX + 20);
    const base = checkRoom(w, h.ix, h.iy);
    expect(base.valid).toBe(true);
    // Deed house: door + torch + table + chair (+ timber, which has no comfort).
    const expected = ['door_closed', 'torch', 'table', 'chair'].reduce((s, k) => s + (TileRegistry.get(id(k)).comfort ?? 0), 0);
    expect(base.comfort).toBe(expected);
    expect(comfortTier(base.comfort!).key).toBe('bare');

    // A second torch adds nothing: each kind counts once.
    w.setFg(h.x0 + 2, h.top + 2, id('torch'), 0);
    expect(checkRoom(w, h.ix, h.iy).comfort).toBe(expected);

    // A stained-glass window in the outer wall counts.
    w.setFg(h.x0 + 6, h.top, id('rose_glass'), 0);
    const withGlass = checkRoom(w, h.ix, h.iy);
    expect(withGlass.valid).toBe(true);
    expect(withGlass.comfort).toBe(expected + TileRegistry.get(id('rose_glass')).comfort!);

    // Planter: counts as decor; a bloom adds the bonus.
    placeObjectRaw(w, h.x0 + 8, h.floor - 1, id('planter'));
    const planted = checkRoom(w, h.ix, h.iy).comfort!;
    w.setFrame(h.x0 + 8, h.floor - 1, planterFrame(1, 3));
    expect(checkRoom(w, h.ix, h.iy).comfort).toBe(planted + BLOOM_BONUS);

    // A painted canvas adds the painting bonus; a blank one does not.
    placeObjectRaw(w, h.x0 + 7, h.top + 1, id('canvas_small'));
    const blank = checkRoom(w, h.ix, h.iy).comfort!;
    const [aw, ah] = canvasArtSize(id('canvas_small'));
    expect(applyRemotePainting(w, { x: h.x0 + 7, y: h.top + 1, w: aw, h: ah, px: '5'.repeat(aw * ah) })).toBe(true);
    expect(checkRoom(w, h.ix, h.iy).comfort).toBe(blank + PAINTING_BONUS);
  });

  it('gives residents of comfortable homes a shop discount', () => {
    const h = house(g.spawnX - 40);
    const n = new NPC(NPC_MAP.get('pedlar')!, 'Test', h.ix * 16, h.iy * 16);
    n.homeX = h.ix;
    n.homeY = h.iy;
    expect(ctx.npcs.priceMultiplier(ctx, n)).toBe(1);
    // Furnish it lavishly around the Deed's chair (x0+3) and table (x0+5..7).
    placeObjectRaw(w, h.x0 + 8, h.floor - 3, id('orrery'));
    placeObjectRaw(w, h.x0 + 11, h.floor - 2, id('hourglass'));
    placeObjectRaw(w, h.x0 + 12, h.floor - 1, id('wisp_jar'));
    placeObjectRaw(w, h.x0 + 2, h.top + 1, id('hanging_lantern'));
    placeObjectRaw(w, h.x0 + 4, h.top + 1, id('wind_chime'));
    placeObjectRaw(w, h.x0 + 6, h.top + 1, id('pennant'));
    placeObjectRaw(w, h.x0 + 9, h.top + 1, id('canvas_small'));
    const cozy = checkRoom(w, h.ix, h.iy);
    expect(comfortTier(cozy.comfort!).key).toBe('cozy');
    expect(ctx.npcs.priceMultiplier(ctx, n)).toBeCloseTo(0.92);
    // A painting and a stained-glass skylight tip it over into Lavish.
    const [aw, ah] = canvasArtSize(id('canvas_small'));
    applyRemotePainting(w, { x: h.x0 + 9, y: h.top + 1, w: aw, h: ah, px: '7'.repeat(aw * ah) });
    w.setFg(h.x0 + 5, h.top, id('amber_glass'), 0);
    const r = checkRoom(w, h.ix, h.iy);
    expect(r.valid).toBe(true);
    expect(comfortTier(r.comfort!).key).toBe('lavish');
    expect(ctx.npcs.priceMultiplier(ctx, n)).toBeCloseTo(0.85);
    expect(ctx.npcs.queryHousing(ctx, h.ix, h.iy)).toMatch(/Lavish/);
  });

  it('planters grow from a seed to a bloom and can be harvested', () => {
    const h = house(g.spawnX + 60);
    const px = h.x0 + 8;
    const py = h.floor - 1;
    placeObjectRaw(w, px, py, id('planter'));
    const inv = ctx.player.inventory;
    inv.main.set(0, { id: 'petal', count: 3 });
    inv.selected = 0;
    interactPlanter(ctx, px, py);
    expect(inv.count('petal')).toBe(2);
    expect(w.getFrame(px, py)).toBe(planterFrame(1, 0));
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0);
    for (let i = 0; i < 5; i++) growPlanter(ctx, px, py);
    rnd.mockRestore();
    expect(w.getFrame(px, py)).toBe(planterFrame(1, 3)); // capped at bloom
    const drops = ctx.entities.drops.length;
    interactPlanter(ctx, px, py);
    expect(ctx.entities.drops.length).toBe(drops + 1);
    expect(ctx.entities.drops.at(-1)!.stack.id).toBe('petal');
    expect(w.getFrame(px, py)).toBe(planterFrame(1, 1)); // regrows from a sprout
  });

  it('canvases hang only on background walls, hanging decor needs a ceiling', () => {
    const h = house(g.spawnX + 100);
    expect(canPlace(ctx, h.x0 + 4, h.top + 2, id('canvas_small'))).toBe(true);
    // Remove one wall tile behind the footprint.
    w.setWall(h.x0 + 5, h.top + 3, 0);
    expect(canPlace(ctx, h.x0 + 4, h.top + 2, id('canvas_small'))).toBe(false);
    expect(canPlace(ctx, h.x0 + 8, h.top + 1, id('wind_chime'))).toBe(true);
    expect(canPlace(ctx, h.x0 + 8, h.top + 2, id('wind_chime'))).toBe(false);
    // Hammering out a wall behind a hung canvas knocks it down (and its painting goes with it).
    placeObjectRaw(w, h.x0 + 8, h.top + 3, id('canvas_small'));
    const [aw, ah] = canvasArtSize(id('canvas_small'));
    applyRemotePainting(w, { x: h.x0 + 8, y: h.top + 3, w: aw, h: ah, px: '1'.repeat(aw * ah) });
    expect(w.paintings.size).toBeGreaterThan(0);
    breakWall(ctx, h.x0 + 9, h.top + 4);
    expect(w.getFg(h.x0 + 8, h.top + 3)).toBe(0);
    expect(w.paintings.has(w.chestKey(h.x0 + 8, h.top + 3))).toBe(false);
  });

  it('validates painting data from saves and the network', () => {
    const [aw, ah] = canvasArtSize(id('canvas_wide'));
    expect(aw * ah).toBeGreaterThan(0);
    expect(sanitizePainting({ x: 1, y: 2, w: 2, h: 2, px: '01af' })).toEqual({ x: 1, y: 2, w: 2, h: 2, px: '01af' });
    expect(sanitizePainting({ x: 1, y: 2, w: 2, h: 2, px: '01ag' })).toBeNull();
    expect(sanitizePainting({ x: 1, y: 2, w: 2, h: 2, px: '01a' })).toBeNull();
    expect(sanitizePainting({ x: 1.5, y: 2, w: 2, h: 2, px: '01af' })).toBeNull();
    expect(sanitizePainting({ x: 1, y: 2, w: 200, h: 2, px: blankArt(200, 2) })).toBeNull();
    // A painting for a spot with no canvas is refused.
    expect(applyRemotePainting(w, { x: 5, y: 5, w: aw, h: ah, px: blankArt(aw, ah) })).toBe(false);
    const st = { ...defaultWorldState(), paintings: [{ x: 1, y: 1, w: 2, h: 2, px: '0123' }, { bogus: true }] };
    const rec = validateWorldRecord({ id: 'w', meta: { id: 'w', seed: 's', name: 'n', size: 'small' }, state: st });
    expect(rec.state.paintings).toEqual([{ x: 1, y: 1, w: 2, h: 2, px: '0123' }]);
    // Old saves without paintings load fine.
    const old = validateWorldRecord({ id: 'w', meta: { id: 'w', seed: 's', name: 'n', size: 'small' }, state: { ...defaultWorldState(), paintings: undefined } });
    expect(old.state.paintings).toEqual([]);
  });

  it('breaking a painted canvas removes its painting', () => {
    const h = house(g.spawnX + 140);
    placeObjectRaw(w, h.x0 + 4, h.top + 2, id('canvas_small'));
    const [aw, ah] = canvasArtSize(id('canvas_small'));
    applyRemotePainting(w, { x: h.x0 + 4, y: h.top + 2, w: aw, h: ah, px: 'c'.repeat(aw * ah) });
    expect(w.getPaintingAt(h.x0 + 5, h.top + 3)).toBeDefined();
    breakTile(ctx, h.x0 + 5, h.top + 3);
    expect(w.getPaintingAt(h.x0 + 4, h.top + 2)).toBeUndefined();
  });

  it('stained glass tints the light that passes through it', () => {
    const h = house(g.spawnX - 80);
    // Replace the roof with rose glass and the torch with nothing, at noon.
    w.setFg(h.x0 + HOUSE_W - 3, h.top + 2, 0, 0);
    for (let x = h.x0 + 1; x < h.x0 + HOUSE_W - 1; x++) w.setFg(x, h.top, id('rose_glass'), 0);
    // Clear anything above so the sun reaches the glass.
    for (let y = 1; y < h.top; y++) for (let x = h.x0; x < h.x0 + HOUSE_W; x++) w.setFg(x, y, 0, 0);
    w.recomputeSkyTop();
    const sky = { r: 1, g: 1, b: 1 };
    const L = ctx.lighting;
    const cx = (h.x0 + 6) * 16;
    const cy = (h.top + 3) * 16;
    L.compute(w, cx - 200, cy - 200, cx + 200, cy + 200, sky, [], { nightVision: false });
    const [r, gg, b] = L.colorAt(h.x0 + 6, h.top + 2)!;
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeGreaterThan(gg * 1.5);
    expect(r).toBeGreaterThan(b * 1.3);
  });
});
