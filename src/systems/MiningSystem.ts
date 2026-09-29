import type { GameContext } from '../core/context';
import { TileRegistry, T } from '../world/TileRegistry';
import { breakTile, breakWall } from '../world/WorldActions';

export type MineResult = 'hit' | 'broke' | 'weak' | 'locked' | 'none';

interface Damage {
  amount: number;
  ticks: number;
}

const DECAY_TICKS = 60 * 5;

/**
 * Accumulates tool damage on tiles until they break. Tile HP = 100 × hardness;
 * each hit deals the tool's power scaled by mining speed.
 */
export class MiningSystem {
  private fg = new Map<number, Damage>();
  private walls = new Map<number, Damage>();
  private lastMessage = 0;

  constructor(private width: number) {}

  private key(x: number, y: number): number {
    return y * this.width + x;
  }

  /** Which tool kind is needed for the foreground tile here, or null. */
  static toolFor(id: number): 'pick' | 'axe' | 'any' | null {
    if (id === 0) return null;
    const def = TileRegistry.get(id);
    if (def.cuttable) return 'any';
    if (def.tool === 'axe') return 'axe';
    if (def.tool === 'any') return 'any';
    return 'pick';
  }

  /** `force` (creative instant-mine) skips tool-power and progression locks. */
  hitTile(ctx: GameContext, x: number, y: number, power: number, kind: 'pick' | 'axe', speed: number, force = false): MineResult {
    const w = ctx.world;
    const id = w.getFg(x, y);
    const need = MiningSystem.toolFor(id);
    if (!need || (need !== 'any' && need !== kind && !force)) return 'none';
    const def = TileRegistry.get(id);
    if (def.lockedUntil && !ctx.progression.has(def.lockedUntil) && !force) {
      this.notify(ctx, 'A strange force binds this ore. It cannot be mined yet.');
      return 'locked';
    }
    if (power < def.toolPower && !force) {
      this.notify(ctx, `Needs ${kind === 'axe' ? 'an axe' : 'a pickaxe'} of power ${def.toolPower}+ (yours: ${power}).`);
      ctx.audio.play('metal', { x: x * 16, y: y * 16, volume: 0.5, pitch: 1.6 });
      return 'weak';
    }
    const hp = 100 * def.hardness;
    const k = this.key(x, y);
    const d = this.fg.get(k) ?? { amount: 0, ticks: 0 };
    // ×1.6 so a starter pickaxe breaks soil in one hit and stone in two.
    d.amount += power * (1 + speed) * 1.6;
    d.ticks = 0;
    if (d.amount >= hp || hp === 0) {
      this.fg.delete(k);
      if (breakTile(ctx, x, y)) return 'broke';
      return 'none';
    }
    this.fg.set(k, d);
    ctx.particles.dust(x * 16 + 8, y * 16 + 8, def.mapColor, 3);
    ctx.audio.play(def.sound, { x: x * 16 + 8, y: y * 16 + 8, volume: 0.55 });
    return 'hit';
  }

  hitWall(ctx: GameContext, x: number, y: number, power: number, speed: number): MineResult {
    const w = ctx.world;
    const wall = w.getWall(x, y);
    if (!wall) return 'none';
    // Walls behind solid tiles are protected.
    if (w.isSolid(x, y) && w.getFg(x, y) !== T.doorClosed) return 'none';
    if (TileRegistry.wall(wall).key === 'warden_wall' && power < 65) {
      this.notify(ctx, 'These ancient walls resist your hammer.');
      return 'weak';
    }
    const k = this.key(x, y);
    const d = this.walls.get(k) ?? { amount: 0, ticks: 0 };
    d.amount += power * (1 + speed) * 1.5;
    d.ticks = 0;
    if (d.amount >= 100) {
      this.walls.delete(k);
      breakWall(ctx, x, y);
      return 'broke';
    }
    this.walls.set(k, d);
    ctx.particles.dust(x * 16 + 8, y * 16 + 8, TileRegistry.wall(wall).mapColor, 2);
    ctx.audio.play('stone', { x: x * 16, y: y * 16, volume: 0.4, pitch: 0.8 });
    return 'hit';
  }

  private notify(ctx: GameContext, text: string): void {
    if (ctx.tick - this.lastMessage > 90) {
      this.lastMessage = ctx.tick;
      ctx.message(text, '#ffb070');
    }
  }

  /** Crack progress 0..1 for rendering. */
  crack(x: number, y: number, world: { getFg(x: number, y: number): number }): number {
    const d = this.fg.get(this.key(x, y));
    if (!d) return 0;
    const hp = 100 * TileRegistry.get(world.getFg(x, y)).hardness;
    return hp > 0 ? Math.min(1, d.amount / hp) : 0;
  }

  forEachDamaged(fn: (x: number, y: number, frac: number) => void, world: { getFg(x: number, y: number): number }): void {
    for (const [k, d] of this.fg) {
      const x = k % this.width;
      const y = Math.floor(k / this.width);
      const hp = 100 * TileRegistry.get(world.getFg(x, y)).hardness;
      if (hp > 0) fn(x, y, Math.min(1, d.amount / hp));
    }
  }

  update(): void {
    for (const map of [this.fg, this.walls]) {
      for (const [k, d] of map) {
        d.ticks++;
        if (d.ticks > DECAY_TICKS) map.delete(k);
      }
    }
  }
}
