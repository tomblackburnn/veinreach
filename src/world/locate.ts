import type { World } from './World';

/** Can a 2×3-tile player stand with feet on row `y` at column `x`? */
function standable(w: World, x: number, y: number): boolean {
  if (!w.inBounds(x, y + 1) || !w.isSolid(x, y + 1) || !w.isSolid(x + 1, y + 1)) return false;
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) if (w.isSolid(x + dx, y - dy) || w.getLiquid(x + dx, y - dy) > 100) return false;
  return true;
}

/** Nearest safe standing spot to (x, y), searching outward. */
export function findStandSpot(w: World, x: number, y: number, radius = 60): [number, number] | null {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (const dx of [-r, r]) if (standable(w, x + dx, y + dy)) return [x + dx, y + dy];
    }
    for (let dx = -r + 1; dx < r; dx++) {
      for (const dy of [-r, r]) if (standable(w, x + dx, y + dy)) return [x + dx, y + dy];
    }
  }
  return null;
}

/** Surface standing spot in a column. */
export function surfaceSpot(w: World, x: number): [number, number] {
  let y = 0;
  while (y < w.height - 2 && !w.isSolid(x, y + 1)) y++;
  return findStandSpot(w, x, y, 20) ?? [x, y];
}

/** Nearest tile of any of the given ids to (x, y) (coarse scan). */
export function findNearestTile(w: World, ids: Set<number>, x: number, y: number, step = 2): [number, number] | null {
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let yy = 0; yy < w.height; yy += step) {
    for (let xx = 0; xx < w.width; xx += step) {
      if (!ids.has(w.getFg(xx, yy))) continue;
      const d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < bd) {
        bd = d;
        best = [xx, yy];
      }
    }
  }
  return best;
}
