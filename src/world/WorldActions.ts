import type { GameContext } from '../core/context';
import { TileRegistry, T } from './TileRegistry';
import { placeObjectRaw, removeObjectRaw, canPlaceFootprint } from './objects';
import { rollLootTable } from '../systems/LootSystem';
import { Rng } from '../utils/random';
import { rectsOverlap } from '../utils/math';
import type { TileDef } from './tileTypes';

const S = 16;
const lootRng = new Rng((Date.now() ^ 0x5bd1e995) >>> 0);

export interface BreakOpts {
  drop?: boolean;
  /** Applied from a network message: no events re-emitted. */
  remote?: boolean;
  /** Suppress effects (bulk edits). */
  quiet?: boolean;
}

function dropAt(ctx: GameContext, id: string, count: number, tx: number, ty: number): void {
  if (count > 0) ctx.dropItem({ id, count }, tx * S + 8, ty * S + 8, (Math.random() - 0.5) * 2, -1.5);
}

function effects(ctx: GameContext, def: TileDef, tx: number, ty: number): void {
  const col = def.mapColor === '#000000' ? '#888888' : def.mapColor;
  ctx.particles.dust(tx * S + 8, ty * S + 8, col, 8);
  ctx.audio.play(def.sound, { x: tx * S + 8, y: ty * S + 8, volume: 0.9 });
}

/**
 * Break the foreground tile at (x,y) with all side effects: drops, tree
 * felling, chests, urn loot and cascading support checks.
 */
export function breakTile(ctx: GameContext, x: number, y: number, o: BreakOpts = {}): boolean {
  const w = ctx.world;
  const id = w.getFg(x, y);
  if (id === 0) return false;
  const def = TileRegistry.get(id);
  const drop = o.drop !== false;

  if (id === T.chest) {
    const chest = w.getChestAt(x, y);
    if (chest && chest.items.some((s) => s)) {
      if (!o.remote) ctx.message('Empty the chest before breaking it.', '#ffb070');
      return false;
    }
  }

  if (id === T.trunk || id === T.treetop || id === T.cactus) {
    fell(ctx, x, y, id, drop);
  } else if (def.size) {
    const [ox, oy] = removeObjectRaw(w, x, y);
    if (id === T.chest) w.chests.delete(w.chestKey(ox, oy));
    w.paintings.delete(w.chestKey(ox, oy));
    if (id === T.pot) {
      if (drop) {
        const deep = oy > w.layers.cavernY;
        for (const s of rollLootTable(deep ? 'pot_deep' : 'pot_shallow', lootRng, { flags: ctx.progression.flags })) dropAt(ctx, s.id, s.count, ox + 1, oy);
      }
      ctx.particles.emit(ox * S + 16, oy * S + 16, { count: 16, colors: ['#a35a45', '#834634', '#b96d56'], speed: [1, 3], life: [20, 40], gravity: 0.2 });
      ctx.audio.play('glass', { x: ox * S, y: oy * S, pitch: 0.6 });
    } else if (drop && def.drop) dropAt(ctx, def.drop, 1, ox, oy);
    const [sw, sh] = def.size;
    for (let yy = oy - 1; yy <= oy + sh; yy++) for (let xx = ox - 1; xx <= ox + sw; xx++) validateSupport(ctx, xx, yy, 0, drop);
  } else {
    w.setFg(x, y, 0, 0);
    if (drop && def.drop) {
      const [a, b] = def.dropCount ?? [1, 1];
      dropAt(ctx, def.drop, a + Math.floor(Math.random() * (b - a + 1)), x, y);
    }
    neighbours(ctx, x, y, drop);
  }
  if (!o.quiet) effects(ctx, def, x, y);
  if (!o.remote) ctx.bus.emit('worldEdit', { op: 'break', x, y });
  return true;
}

function neighbours(ctx: GameContext, x: number, y: number, drop: boolean): void {
  validateSupport(ctx, x, y - 1, 0, drop);
  validateSupport(ctx, x, y + 1, 0, drop);
  validateSupport(ctx, x - 1, y, 0, drop);
  validateSupport(ctx, x + 1, y, 0, drop);
}

/** Remove a whole tree/cactus column above (and including) (x,y). */
function fell(ctx: GameContext, x: number, y: number, id: number, drop: boolean): void {
  const w = ctx.world;
  const cactus = id === T.cactus;
  const kind = w.getFrame(x, y); // tree species, read before the tiles are removed
  let yy = y;
  let wood = 0;
  let top = false;
  while (yy >= 0) {
    const cur = w.getFg(x, yy);
    if (cactus ? cur !== T.cactus : cur !== T.trunk && cur !== T.treetop) break;
    if (cur === T.treetop) top = true;
    w.setFg(x, yy, 0, 0);
    ctx.particles.emit(x * S + 8, yy * S + 8, { count: 3, colors: cactus ? ['#3f8a4a'] : ['#6b4526', '#3d8a2f'], speed: [0.5, 2], life: [20, 40] });
    wood++;
    yy--;
  }
  if (drop) {
    if (cactus) dropAt(ctx, 'cactus', wood, x, y);
    else {
      dropAt(ctx, 'wood', wood * 2 + (top ? 3 : 0), x, y);
      if (top && Math.random() < 0.6) dropAt(ctx, 'seedling', 1 + Math.floor(Math.random() * 2), x, y);
      if (top && Math.random() < 0.15) dropAt(ctx, 'mushroom', 1, x, y);
      // Leafy crowns shed thatch (not dead or mushroom trees).
      if (top && kind !== 3 && kind !== 4) dropAt(ctx, 'leafthatch', 2 + Math.floor(Math.random() * 3), x, y);
    }
  }
  if (top) {
    ctx.particles.emit(x * S + 8, (yy + 1) * S, { count: 30, colors: ['#3d8a2f', '#58a846', '#2a6a20'], speed: [0.5, 3], life: [30, 60], gravity: 0.05, jitter: 20 });
    ctx.audio.play('plant', { x: x * S, y: yy * S, volume: 1, pitch: 0.7 });
  }
  neighbours(ctx, x, y, drop);
}

/** Does the tile at (x,y) still have what it needs to exist? Break it if not. */
export function validateSupport(ctx: GameContext, x: number, y: number, depth = 0, drop = true): void {
  if (depth > 64) return;
  const w = ctx.world;
  const id = w.getFg(x, y);
  if (id === 0) return;
  const def = TileRegistry.get(id);
  if (!def.support || def.support === 'none') return;
  if (supported(ctx, x, y, id, def)) return;
  if (id === T.trunk || id === T.treetop || id === T.cactus) {
    fell(ctx, x, y, id, drop);
    return;
  }
  breakTile(ctx, x, y, { drop, quiet: true });
}

function solidOrPlat(ctx: GameContext, x: number, y: number): boolean {
  const w = ctx.world;
  const id = w.getFg(x, y);
  return w.isSolid(x, y) || TileRegistry.platform[id] === 1 || !!TileRegistry.get(id).furniture?.includes('table');
}

function supported(ctx: GameContext, x: number, y: number, id: number, def: TileDef): boolean {
  const w = ctx.world;
  switch (def.support) {
    case 'floor': {
      if (id === T.trunk || id === T.treetop || id === T.cactus) {
        const below = w.getFg(x, y + 1);
        return below === id || below === T.trunk || w.isSolid(x, y + 1);
      }
      if (def.size) {
        const [ox, oy] = w.objectOrigin(x, y);
        const [sw, sh] = def.size;
        for (let xx = ox; xx < ox + sw; xx++) if (solidOrPlat(ctx, xx, oy + sh)) return true;
        return false;
      }
      return solidOrPlat(ctx, x, y + 1);
    }
    case 'ceiling': {
      if (def.size) {
        // Hanging objects: something solid (or a platform) above the top row.
        const [ox, oy] = w.objectOrigin(x, y);
        for (let xx = ox; xx < ox + def.size[0]; xx++) if (w.isSolid(xx, oy - 1) || TileRegistry.platform[w.getFg(xx, oy - 1)] === 1) return true;
        return false;
      }
      return w.isSolid(x, y - 1) || w.getFg(x, y - 1) === id;
    }
    case 'wall': {
      // Wall-hung objects need a background wall behind every cell.
      const [ox, oy] = def.size ? w.objectOrigin(x, y) : [x, y];
      const [sw, sh] = def.size ?? [1, 1];
      for (let yy = oy; yy < oy + sh; yy++) for (let xx = ox; xx < ox + sw; xx++) if (w.getWall(xx, yy) === 0) return false;
      return true;
    }
    case 'attach':
      return (
        w.getWall(x, y) !== 0 ||
        [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
          const n = w.getFg(x + dx, y + dy);
          return w.isSolid(x + dx, y + dy) || TileRegistry.platform[n] === 1 || (n === id && id !== T.torch);
        })
      );
    default:
      return true;
  }
}

/** Would placing `tileId` with origin (x,y) be legal? (ignores player range) */
export function canPlace(ctx: GameContext, x: number, y: number, tileId: number): boolean {
  const w = ctx.world;
  const def = TileRegistry.get(tileId);
  const [sw, sh] = def.size ?? [1, 1];
  if (!canPlaceFootprint(w, x, y, sw, sh, def.support === 'floor' && !!def.size)) return false;
  if (!def.size) {
    const cur = w.getFg(x, y);
    if (cur !== 0 && !TileRegistry.cuttable[cur]) return false;
    if (w.getLiquid(x, y) > 0 && def.solid === false && def.support === 'attach' && tileId === T.torch) return false;
  }
  // Anything solid must not overlap actors.
  if (def.solid) {
    const r = { x: x * S, y: y * S, w: sw * S, h: sh * S };
    const actors = [...ctx.entities.players, ...ctx.entities.npcs, ...ctx.entities.enemies];
    if (actors.some((a) => !a.dead && rectsOverlap(r, a.rect()))) return false;
  }
  if (tileId === T.sapling) {
    const below = w.getFg(x, y + 1);
    return [T.meadowgrass, T.snow, T.sand, T.lumenmoss, T.blightgrass, T.shardgrass].includes(below);
  }
  if (def.support && def.support !== 'none') {
    if (!def.size && !supported(ctx, x, y, tileId, def)) return false;
    if (def.size && def.support === 'ceiling') {
      let hung = false;
      for (let xx = x; xx < x + sw; xx++) if (w.isSolid(xx, y - 1) || TileRegistry.platform[w.getFg(xx, y - 1)] === 1) hung = true;
      if (!hung) return false;
    }
    if (def.size && def.support === 'wall') {
      for (let yy = y; yy < y + sh; yy++) for (let xx = x; xx < x + sw; xx++) if (w.getWall(xx, yy) === 0) return false;
    }
    return true;
  }
  // Plain blocks need a neighbouring tile or wall to attach to.
  if (w.getWall(x, y) !== 0) return true;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (w.getFg(x + dx, y + dy) !== 0 && !TileRegistry.cuttable[w.getFg(x + dx, y + dy)]) return true;
  return false;
}

export function placeTile(ctx: GameContext, x: number, y: number, tileId: number, o: { remote?: boolean; force?: boolean } = {}): boolean {
  if (!o.force && !canPlace(ctx, x, y, tileId)) return false;
  const w = ctx.world;
  const def = TileRegistry.get(tileId);
  // Clear cuttable plants in the footprint.
  const [sw, sh] = def.size ?? [1, 1];
  for (let yy = y; yy < y + sh; yy++) for (let xx = x; xx < x + sw; xx++) if (TileRegistry.cuttable[w.getFg(xx, yy)]) w.setFg(xx, yy, 0, 0);
  placeObjectRaw(w, x, y, tileId);
  if (tileId === T.chest && !w.chests.has(w.chestKey(x, y))) w.chests.set(w.chestKey(x, y), { x, y, items: new Array(40).fill(null) });
  // Grass under a new solid block turns back to soil.
  const below = w.getFg(x, y + sh);
  const belowDef = TileRegistry.get(below);
  if (def.solid && belowDef.grassOf) w.setFg(x, y + sh, TileRegistry.id(belowDef.grassOf), 0);
  if (!o.remote) {
    ctx.audio.play('place', { x: x * S + 8, y: y * S + 8 });
    ctx.bus.emit('worldEdit', { op: 'place', x, y, tile: tileId });
  }
  return true;
}

export function breakWall(ctx: GameContext, x: number, y: number, o: BreakOpts = {}): boolean {
  const w = ctx.world;
  const id = w.getWall(x, y);
  if (!id) return false;
  const def = TileRegistry.wall(id);
  w.setWall(x, y, 0);
  if (o.drop !== false && def.drop) dropAt(ctx, def.drop, 1, x, y);
  if (!o.quiet) {
    ctx.particles.dust(x * S + 8, y * S + 8, def.mapColor, 5);
    ctx.audio.play('stone', { x: x * S, y: y * S, volume: 0.6, pitch: 0.8 });
  }
  validateSupport(ctx, x, y, 0, o.drop !== false);
  if (!o.remote) ctx.bus.emit('worldEdit', { op: 'breakWall', x, y });
  return true;
}

export function canPlaceWall(ctx: GameContext, x: number, y: number): boolean {
  const w = ctx.world;
  if (!w.inBounds(x, y) || w.getWall(x, y) !== 0) return false;
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (w.getWall(x + dx, y + dy) !== 0 || w.isSolid(x + dx, y + dy)) return true;
  return w.getFg(x, y) !== 0;
}

export function placeWall(ctx: GameContext, x: number, y: number, wallId: number, o: { remote?: boolean; force?: boolean } = {}): boolean {
  if (!o.force && !canPlaceWall(ctx, x, y)) return false;
  ctx.world.setWall(x, y, wallId);
  if (!o.remote) {
    ctx.audio.play('place', { x: x * S, y: y * S, volume: 0.6 });
    ctx.bus.emit('worldEdit', { op: 'placeWall', x, y, wall: wallId });
  }
  return true;
}

/** Open/close a door at any of its cells. Returns false if blocked. */
export function toggleDoor(ctx: GameContext, x: number, y: number, o: { remote?: boolean; open?: boolean } = {}): boolean {
  const w = ctx.world;
  const id = w.getFg(x, y);
  if (id !== T.doorClosed && id !== T.doorOpen) return false;
  const [ox, oy] = w.objectOrigin(x, y);
  const open = o.open ?? id === T.doorClosed;
  if (!open) {
    const r = { x: ox * S, y: oy * S, w: S, h: 3 * S };
    const blockers = [...ctx.entities.players, ...ctx.entities.npcs, ...ctx.entities.enemies];
    if (blockers.some((a) => rectsOverlap(r, a.rect()))) return false;
  }
  placeObjectRaw(w, ox, oy, open ? T.doorOpen : T.doorClosed);
  if (!o.remote) {
    ctx.audio.play('door', { x: ox * S, y: oy * S });
    ctx.bus.emit('worldEdit', { op: 'door', x: ox, y: oy, open });
  }
  return true;
}
