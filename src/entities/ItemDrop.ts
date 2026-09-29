import { Entity } from './Entity';
import type { GameContext } from '../core/context';
import type { ItemStack } from '../items/ItemStack';
import { moveBody, liquidAt } from '../physics/Physics';
import { PHYSICS, PLAYER_TUNING } from '../core/config';
import { itemIcon } from '../rendering/sprites/itemIcons';
import { ItemRegistry } from '../items/ItemRegistry';
import { RARITY_COLORS } from '../items/types';

const DESPAWN_TICKS = 60 * 60 * 8;

/** An item lying in the world: falls, merges with neighbours, and flies to nearby players. */
export class ItemDrop extends Entity {
  readonly kind = 'drop';
  pickupDelay: number;
  private bob = Math.random() * Math.PI * 2;
  private magnet = false;

  constructor(
    public stack: ItemStack,
    x: number,
    y: number,
    pickupDelay = 20,
  ) {
    super(12, 12);
    this.setCenter(x, y);
    this.pickupDelay = pickupDelay;
  }

  update(ctx: GameContext): void {
    this.age++;
    if (this.pickupDelay > 0) this.pickupDelay--;
    if (this.age > DESPAWN_TICKS && this.stack.id !== 'aurel') {
      this.removed = true;
      return;
    }
    const p = ctx.player;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy);
    this.magnet = false;
    if (!p.dead && this.pickupDelay <= 0 && d < PLAYER_TUNING.pickupRadius && p.inventory.canFit(this.stack)) {
      this.magnet = true;
      const sp = Math.min(9, 2 + (PLAYER_TUNING.pickupRadius - d) * 0.08);
      this.vx += (dx / d) * sp * 0.25;
      this.vy += (dy / d) * sp * 0.25;
      this.vx *= 0.82;
      this.vy *= 0.82;
      this.x += this.vx;
      this.y += this.vy;
      if (d < PLAYER_TUNING.grabRadius) p.pickup(ctx, this);
      return;
    }
    const liquid = liquidAt(ctx.world, this);
    this.vy = Math.min(this.vy + PHYSICS.gravity * (liquid ? 0.3 : 1), liquid ? 2 : PHYSICS.maxFall);
    this.vx *= this.onGround ? 0.8 : 0.98;
    moveBody(ctx.world, this, { platforms: true });
    // Merge with nearby identical stacks occasionally.
    if (this.age % 30 === 0 && this.onGround) {
      for (const o of ctx.entities.drops) {
        if (o === this || o.removed || o.stack.id !== this.stack.id) continue;
        if (Math.abs(o.cx - this.cx) < 24 && Math.abs(o.cy - this.cy) < 24) {
          const max = ItemRegistry.get(this.stack.id).maxStack;
          if (this.stack.count + o.stack.count <= max) {
            this.stack.count += o.stack.count;
            o.removed = true;
          }
        }
      }
    }
  }

  render(g: CanvasRenderingContext2D): void {
    const icon = itemIcon(this.stack.id);
    const bob = this.magnet ? 0 : Math.sin(this.age * 0.08 + this.bob) * 1.5;
    const s = Math.min(1, 14 / Math.max(icon.width, icon.height));
    const w = icon.width * s;
    const h = icon.height * s;
    const rarity = ItemRegistry.get(this.stack.id).rarity;
    if (rarity >= 2) {
      g.globalAlpha = 0.25 + Math.sin(this.age * 0.1) * 0.1;
      g.fillStyle = RARITY_COLORS[rarity] ?? '#fff';
      g.fillRect(this.cx - w / 2 - 1, this.y + this.h - h - 1 + bob, w + 2, h + 2);
      g.globalAlpha = 1;
    }
    g.drawImage(icon, Math.round(this.cx - w / 2), Math.round(this.y + this.h - h + bob), w, h);
  }

  override light() {
    const r = ItemRegistry.get(this.stack.id);
    return r.rarity >= 3 ? { x: this.cx, y: this.cy, r: 0.25, g: 0.25, b: 0.3, radius: 3 } : null;
  }
}
