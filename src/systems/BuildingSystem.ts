import type { GameContext } from '../core/context';
import type { ItemDef } from '../items/types';
import { TileRegistry } from '../world/TileRegistry';
import { canPlace, placeTile, placeWall, canPlaceWall } from '../world/WorldActions';

/** Compute the object origin so the cursor tile is the bottom-centre of the footprint. */
export function placementOrigin(tileKey: string, tx: number, ty: number): [number, number] {
  const def = TileRegistry.get(TileRegistry.id(tileKey));
  const [w, h] = def.size ?? [1, 1];
  return [tx - Math.floor((w - 1) / 2), ty - (h - 1)];
}

export function canPlaceItemAt(ctx: GameContext, def: ItemDef, tx: number, ty: number): boolean {
  if (def.placeTile) {
    const [ox, oy] = placementOrigin(def.placeTile, tx, ty);
    return canPlace(ctx, ox, oy, TileRegistry.id(def.placeTile));
  }
  if (def.placeWall) return canPlaceWall(ctx, tx, ty);
  return false;
}

/** Place the held block/wall/furniture at a tile. Returns true if something was placed. */
export function placeItemAt(ctx: GameContext, def: ItemDef, tx: number, ty: number): boolean {
  if (def.placeTile) {
    const [ox, oy] = placementOrigin(def.placeTile, tx, ty);
    const id = TileRegistry.id(def.placeTile);
    if (!placeTile(ctx, ox, oy, id)) return false;
    const td = TileRegistry.get(id);
    ctx.particles.dust(ox * 16 + 8, oy * 16 + 8, td.mapColor, 3);
    return true;
  }
  if (def.placeWall) return placeWall(ctx, tx, ty, TileRegistry.wallId(def.placeWall));
  return false;
}
