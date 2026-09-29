import type { GameContext } from '../core/context';

/**
 * Planter boxes. The tile frame packs the plant kind and growth stage as
 * kind*4 + stage: kind 0 is empty, stage 3 is in bloom.
 */
export interface PlanterPlant {
  kind: number;
  seed: string;
  name: string;
  /** Harvest yield when in bloom (null = purely decorative). */
  harvest: [string, number, number] | null;
}

export const PLANTER_PLANTS: PlanterPlant[] = [
  { kind: 1, seed: 'petal', name: 'Wildflowers', harvest: ['petal', 2, 3] },
  { kind: 2, seed: 'glowshroom', name: 'Glowshrooms', harvest: ['glowshroom', 1, 2] },
  { kind: 3, seed: 'emberbloom', name: 'Emberblooms', harvest: ['emberbloom', 1, 2] },
  { kind: 4, seed: 'seedling', name: 'Bonsai', harvest: null },
];

export const planterKind = (frame: number): number => frame >> 2;
export const planterStage = (frame: number): number => frame & 3;
export const planterFrame = (kind: number, stage: number): number => (kind << 2) | (stage & 3);

/** Chance per random tick that a planted planter grows one stage. */
export const PLANTER_GROWTH_CHANCE = 0.2;

/** Right-click on a planter: plant the held seed, or harvest a bloom. Returns true if handled. */
export function interactPlanter(ctx: GameContext, x: number, y: number): boolean {
  const w = ctx.world;
  const frame = w.getFrame(x, y);
  const kind = planterKind(frame);
  const p = ctx.player;
  if (kind === 0) {
    const held = p.inventory.heldItem();
    const plant = held ? PLANTER_PLANTS.find((pl) => pl.seed === held.id) : undefined;
    if (!plant) {
      ctx.message('Hold a Wildflower Petal, Glowshroom, Emberbloom or Seedling and right-click to plant it.', '#d0e0a0');
      return true;
    }
    p.inventory.main.takeFromSlot(p.inventory.selected, 1);
    w.setFrame(x, y, planterFrame(plant.kind, 0));
    ctx.audio.play('plant', { x: x * 16 + 8, y: y * 16 + 8 });
    ctx.particles.dust(x * 16 + 8, y * 16 + 6, '#7a4e2d', 4);
    return true;
  }
  const plant = PLANTER_PLANTS.find((pl) => pl.kind === kind);
  if (planterStage(frame) < 3) {
    ctx.message(`The ${plant?.name ?? 'plant'} is still growing.`, '#d0e0a0');
    return true;
  }
  if (!plant?.harvest) {
    ctx.message('A perfectly trimmed little tree. Nothing to harvest.', '#d0e0a0');
    return true;
  }
  const [id, lo, hi] = plant.harvest;
  ctx.dropItem({ id, count: lo + Math.floor(Math.random() * (hi - lo + 1)) }, x * 16 + 8, y * 16);
  w.setFrame(x, y, planterFrame(kind, 1));
  ctx.audio.play('plant', { x: x * 16 + 8, y: y * 16 + 8, pitch: 1.3 });
  return true;
}

/** Random-tick growth. */
export function growPlanter(ctx: GameContext, x: number, y: number): void {
  const frame = ctx.world.getFrame(x, y);
  if (planterKind(frame) === 0 || planterStage(frame) >= 3) return;
  if (Math.random() < PLANTER_GROWTH_CHANCE) ctx.world.setFrame(x, y, frame + 1);
}
