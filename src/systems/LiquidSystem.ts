import type { World } from '../world/World';
import { LIQUID, TileRegistry } from '../world/TileRegistry';

const MAX_PER_STEP = 2500;

/**
 * Simplified cellular liquids. Only "awake" cells are simulated; a cell goes
 * back to sleep when it stops changing. Water + magma make Basaltglass.
 */
export class LiquidSystem {
  private active = new Set<number>();
  private basalt = TileRegistry.id('basalt');
  /** Tiles changed by liquid contact (for network sync). */
  onSolidify: ((x: number, y: number) => void) | null = null;

  constructor(private world: World) {}

  get awake(): number {
    return this.active.size;
  }

  wake(x: number, y: number): void {
    const w = this.world;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (w.inBounds(nx, ny) && w.getLiquid(nx, ny) > 0) this.active.add(ny * w.width + nx);
      }
    }
  }

  /** Wake every liquid cell in a rectangle (e.g. around the player on load). */
  wakeArea(x0: number, y0: number, x1: number, y1: number): void {
    const w = this.world;
    for (let y = Math.max(0, y0); y < Math.min(w.height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w.width, x1); x++) {
        const a = w.getLiquid(x, y);
        if (a > 0 && (a < 255 || this.canFall(x, y) || this.canSpread(x - 1, y, a) || this.canSpread(x + 1, y, a))) this.active.add(y * w.width + x);
      }
    }
  }

  private canFall(x: number, y: number): boolean {
    return y + 1 < this.world.height && !this.world.isSolid(x, y + 1) && this.world.getLiquid(x, y + 1) < 255;
  }

  private canSpread(x: number, y: number, amt: number): boolean {
    return this.world.inBounds(x, y) && !this.world.isSolid(x, y) && this.world.getLiquid(x, y) + 2 < amt;
  }

  step(cx: number, cy: number, radius: number): void {
    if (!this.active.size) return;
    const w = this.world;
    const cells = [...this.active];
    this.active.clear();
    // Process bottom-up so falling liquid settles in one pass.
    cells.sort((a, b) => b - a);
    let n = 0;
    for (const k of cells) {
      const x = k % w.width;
      const y = Math.floor(k / w.width);
      if (Math.abs(x - cx) > radius || Math.abs(y - cy) > radius || n > MAX_PER_STEP) {
        this.active.add(k);
        continue;
      }
      n++;
      this.flow(x, y);
    }
  }

  private flow(x: number, y: number): void {
    const w = this.world;
    let amt = w.getLiquid(x, y);
    if (amt === 0) return;
    const type = w.getLiquidType(x, y);
    if (w.isSolid(x, y)) {
      w.setLiquid(x, y, 0, 0);
      return;
    }
    // Contact reaction.
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const n = w.getLiquid(nx, ny);
      if (n > 0 && w.getLiquidType(nx, ny) !== type) {
        const tx = dy === -1 ? x : nx;
        const ty = dy === -1 ? y : ny;
        w.setLiquid(nx, ny, 0, 0);
        w.setLiquid(x, y, 0, 0);
        w.setFg(tx, ty, this.basalt, 0);
        this.onSolidify?.(tx, ty);
        this.wake(x, y);
        return;
      }
    }
    let changed = false;
    // Fall.
    if (y + 1 < w.height && !w.isSolid(x, y + 1)) {
      const below = w.getLiquid(x, y + 1);
      const space = 255 - below;
      if (space > 0) {
        const move = Math.min(space, amt);
        w.setLiquid(x, y + 1, below + move, type);
        amt -= move;
        w.setLiquid(x, y, amt, type);
        changed = true;
        this.active.add((y + 1) * w.width + x);
      }
    }
    // Spread sideways when resting on something.
    if (amt > 0) {
      const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
      for (const d of dirs) {
        const nx = x + d;
        if (nx < 0 || nx >= w.width || w.isSolid(nx, y)) continue;
        const n = w.getLiquid(nx, y);
        if (n + 2 < amt) {
          const move = Math.ceil((amt - n) / (type === LIQUID.lava ? 4 : 2));
          w.setLiquid(nx, y, n + move, type);
          amt -= move;
          w.setLiquid(x, y, amt, type);
          changed = true;
          this.active.add(y * w.width + nx);
        }
      }
    }
    // Evaporate tiny films.
    if (amt > 0 && amt < 4 && w.isSolid(x, y + 1)) {
      w.setLiquid(x, y, 0, 0);
      changed = true;
    }
    if (changed) this.wake(x, y);
  }
}
