import type { GameContext } from '../core/context';
import type { Player } from '../entities/player/Player';
import type { ItemDef } from '../items/types';
import { ItemRegistry } from '../items/ItemRegistry';
import { segmentHitsRect } from '../utils/math';
import { TileRegistry, LIQUID } from '../world/TileRegistry';
import { breakTile } from '../world/WorldActions';
import { placeItemAt } from '../systems/BuildingSystem';
import { PLAYER_TUNING } from '../core/config';

const SWING_START = -2.3;
const SWING_END = 1.0;
const BASE_CRIT = 4;

export type UseStyleState = 'swing' | 'aim' | 'thrust' | 'hold' | null;

/** Is tile (tx,ty) within the player's reach for this item? */
export function inReach(p: Player, tx: number, ty: number, extra = 0): boolean {
  const r = PLAYER_TUNING.reach + extra;
  const px = p.cx / 16;
  const py = p.cy / 16;
  return Math.abs(tx + 0.5 - px) <= r + 1 && Math.abs(ty + 0.5 - py) <= r;
}

/**
 * Drives using the held item each tick: swing arcs, firing, mining, placing,
 * drinking. Also exposes the current arm/held-item pose for rendering.
 */
export class ItemUse {
  timer = 0;
  max = 0;
  item: ItemDef | null = null;
  style: UseStyleState = null;
  /** World-space aim/blade angle. */
  angle = 0;
  private hitIds = new Set<number>();
  private facing: 1 | -1 = 1;

  get active(): boolean {
    return this.timer > 0;
  }

  cancel(): void {
    this.timer = 0;
    this.item = null;
    this.style = null;
  }

  update(p: Player, ctx: GameContext): void {
    if (this.timer > 0) {
      this.timer--;
      if (this.style === 'swing' && this.item) this.tickSwing(p, ctx);
      if (this.style === 'aim') this.angle = Math.atan2(p.input.aimY - (p.cy - 4), p.input.aimX - p.cx);
      if (this.timer === 0) this.style = null;
      return;
    }
    const held = p.inventory.heldItem();
    if (!held || !p.input.use) return;
    const def = ItemRegistry.get(held.id);
    const auto = def.autoReuse || def.category === 'tool' || !!def.placeTile || !!def.placeWall;
    if (!auto && !p.input.usePressed) return;
    this.start(p, ctx, def);
  }

  private aimAngle(p: Player): number {
    return Math.atan2(p.input.aimY - (p.cy - 4), p.input.aimX - p.cx);
  }

  private begin(p: Player, def: ItemDef, time: number, style: UseStyleState): void {
    this.item = def;
    this.timer = this.max = Math.max(2, Math.round(time));
    this.style = style;
    this.hitIds.clear();
    this.facing = p.input.aimX >= p.cx ? 1 : -1;
    p.facing = this.facing;
    this.angle = style === 'swing' ? this.swingWorldAngle(0) : this.aimAngle(p);
  }

  private swingWorldAngle(t: number): number {
    const local = SWING_START + (SWING_END - SWING_START) * t;
    return this.facing > 0 ? local : Math.PI - local;
  }

  private start(p: Player, ctx: GameContext, def: ItemDef): void {
    const st = p.stats;
    const tx = Math.floor(p.input.aimX / 16);
    const ty = Math.floor(p.input.aimY / 16);
    const useTime = def.useTime ?? 20;

    // --- Placement ---
    if (def.placeTile || def.placeWall) {
      if (!inReach(p, tx, ty)) return;
      if (placeItemAt(ctx, def, tx, ty)) {
        if (!p.cheats.infinite) p.inventory.main.remove(def.id, 1) || p.inventory.consume(def.id, 1);
        this.begin(p, def, useTime, 'swing');
      }
      return;
    }

    // --- Tools (mining also swings) ---
    if (def.tool) {
      const speed = st.miningSpeed;
      this.begin(p, def, p.cheats.instantMine ? 5 : useTime / (1 + speed * 0.6), 'swing');
      this.useTool(p, ctx, def, tx, ty);
      ctx.audio.play('swing', { volume: 0.4 });
      return;
    }

    const w = def.weapon;
    if (w) {
      const dmgBonus = st.damage + (w.kind === 'melee' ? st.meleeDamage : w.kind === 'ranged' ? st.rangedDamage : w.kind === 'magic' ? st.magicDamage : st.summonDamage);
      const crit = BASE_CRIT + (w.crit ?? 0) + st.crit;
      const damage = w.damage * (1 + dmgBonus);
      const a = this.aimAngle(p);
      const hx = p.cx;
      const hy = p.cy - 4;
      if (w.kind === 'melee' && def.useStyle === 'swing') {
        this.begin(p, def, useTime / (1 + st.meleeSpeed), 'swing');
        ctx.audio.play('swing');
        if (w.swingProjectile) this.fireSpecial(p, ctx, w.swingProjectile, damage * 0.75, w.knockback * 0.5, crit, w.shootSpeed ?? 9, a, w);
        return;
      }
      if (w.kind === 'melee') {
        // Thrown / thrust weapons: one projectile active at a time.
        const pid = w.projectile!;
        if (ctx.entities.projectiles.some((pr) => pr.o.owner === p && pr.def.id === pid)) return;
        this.begin(p, def, useTime / (1 + st.meleeSpeed), def.useStyle === 'thrust' ? 'thrust' : 'aim');
        ctx.spawnProjectile(pid, hx, hy, Math.cos(a) * (w.shootSpeed ?? 8), Math.sin(a) * (w.shootSpeed ?? 8), { damage, knockback: w.knockback, friendly: true, owner: p, critChance: crit, damageClass: 'melee', onHit: w.onHit });
        ctx.audio.play('swing', { pitch: 1.2 });
        return;
      }
      if (w.kind === 'ranged') {
        let pid = w.projectile;
        let dmg = damage;
        let speed = w.shootSpeed ?? 8;
        if (w.ammo) {
          const ammoId = p.inventory.findAmmo(w.ammo);
          if (!ammoId) {
            if (p.input.usePressed) ctx.message(`Out of ${w.ammo === 'arrow' ? 'arrows' : 'pellets'}!`, '#ffb070');
            return;
          }
          const ad = ItemRegistry.get(ammoId).ammo!;
          pid = w.projectile ?? ad.projectile;
          dmg += ad.damage * (1 + dmgBonus);
          speed += ad.speedBonus ?? 0;
          if (!p.cheats.infinite) p.inventory.consume(ammoId, 1);
        }
        this.begin(p, def, useTime, 'aim');
        this.shoot(p, ctx, pid!, dmg, w.knockback, crit, speed, a, w.shots ?? 1, w.spread ?? 0.04, 'ranged', w.onHit);
        ctx.audio.play(w.ammo === 'pellet' ? 'gun' : 'bow');
        if (w.ammo === 'pellet') {
          ctx.particles.sparks(hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, '#ffe070', 6, a);
          ctx.shake(0.04);
        }
        return;
      }
      if (w.kind === 'magic' || w.kind === 'summon') {
        const cost = Math.max(1, Math.round((w.manaCost ?? 5) * (1 - st.manaCostReduce)));
        if (!p.spendMana(cost)) {
          if (p.input.usePressed) ctx.message('Not enough mana.', '#8fa0ff');
          return;
        }
        this.begin(p, def, useTime, 'aim');
        if (w.kind === 'summon') {
          this.summon(p, ctx, w.projectile!, damage, w.knockback);
          ctx.audio.play('summon');
          return;
        }
        this.fireSpecial(p, ctx, w.projectile!, damage, w.knockback, crit, w.shootSpeed ?? 8, a, w);
        ctx.audio.play('magic');
        return;
      }
    }

    if (def.consumable) {
      if (useConsumable(p, ctx, def)) this.begin(p, def, useTime, 'hold');
      return;
    }
    if (def.summonBoss) {
      const err = ctx.bosses.trySummon(def.summonBoss, p);
      if (err) {
        if (p.input.usePressed) ctx.message(err, '#ffb070');
        return;
      }
      if (!p.cheats.infinite) p.inventory.main.remove(def.id, 1);
      this.begin(p, def, useTime, 'hold');
      return;
    }
    if (def.startsEvent) {
      const err = ctx.worldEvents.tryStart(def.startsEvent, true);
      if (err) {
        if (p.input.usePressed) ctx.message(err, '#ffb070');
        return;
      }
      if (!p.cheats.infinite) p.inventory.main.remove(def.id, 1);
      this.begin(p, def, useTime, 'hold');
      return;
    }
    if (def.utility === 'guide') {
      if (p.input.usePressed) ctx.ui.openGuide();
      return;
    }
    if (def.utility === 'recall') {
      if (!p.input.usePressed) return;
      this.begin(p, def, useTime, 'hold');
      recall(p, ctx);
      return;
    }
    if (def.liquid) {
      if (!inReach(p, tx, ty) || !p.input.usePressed) return;
      if (useBucket(p, ctx, def, tx, ty)) this.begin(p, def, useTime, 'hold');
    }
  }

  private useTool(p: Player, ctx: GameContext, def: ItemDef, tx: number, ty: number): void {
    const t = def.tool!;
    if (!inReach(p, tx, ty, t.range ?? 0)) return;
    const fg = ctx.world.getFg(tx, ty);
    const force = p.cheats.instantMine;
    const speed = force ? 1000 : p.stats.miningSpeed;
    if (fg !== 0) {
      const need = TileRegistry.get(fg).tool;
      if (need === 'axe' && (t.axe || force)) ctx.mining.hitTile(ctx, tx, ty, t.axe ?? 100, 'axe', speed, force);
      else if ((need === 'pickaxe' || need === 'any') && (t.pick || force)) ctx.mining.hitTile(ctx, tx, ty, t.pick ?? 100, 'pick', speed, force);
      else if (TileRegistry.cuttable[fg]) breakTile(ctx, tx, ty);
      else if (t.hammer) ctx.mining.hitWall(ctx, tx, ty, t.hammer, speed);
    } else if (t.hammer) {
      ctx.mining.hitWall(ctx, tx, ty, t.hammer, speed);
    }
  }

  /** Projectiles that rain from the sky toward the cursor, or ordinary aimed shots. */
  private fireSpecial(p: Player, ctx: GameContext, pid: string, damage: number, kb: number, crit: number, speed: number, a: number, w: NonNullable<ItemDef['weapon']>): void {
    if (pid === 'astral_star' || pid === 'starfall') {
      const n = w.shots ?? (pid === 'starfall' ? 1 : 2);
      for (let i = 0; i < n; i++) {
        const sx = p.input.aimX + (Math.random() - 0.5) * 200;
        const sy = ctx.camera.top - 40;
        const ang = Math.atan2(p.input.aimY - sy, p.input.aimX - sx);
        ctx.spawnProjectile(pid, sx, sy, Math.cos(ang) * speed * 1.4, Math.sin(ang) * speed * 1.4, { damage, knockback: kb, friendly: true, owner: p, critChance: crit, damageClass: w.kind, onHit: w.onHit });
      }
      return;
    }
    this.shoot(p, ctx, pid, damage, kb, crit, speed, a, w.shots ?? 1, w.spread ?? 0.03, w.kind, w.onHit);
  }

  private shoot(p: Player, ctx: GameContext, pid: string, damage: number, kb: number, crit: number, speed: number, a: number, shots: number, spread: number, kind: 'melee' | 'ranged' | 'magic' | 'summon', onHit?: { buff: string; seconds: number; chance: number }): void {
    for (let i = 0; i < shots; i++) {
      const off = shots > 1 ? (i - (shots - 1) / 2) * spread * 2 + (Math.random() - 0.5) * spread : (Math.random() - 0.5) * spread;
      const aa = a + off;
      const sp = speed * (shots > 1 ? 0.9 + Math.random() * 0.2 : 1);
      ctx.spawnProjectile(pid, p.cx + Math.cos(a) * 12, p.cy - 4 + Math.sin(a) * 12, Math.cos(aa) * sp, Math.sin(aa) * sp, { damage, knockback: kb, friendly: true, owner: p, critChance: crit, damageClass: kind, onHit });
    }
  }

  private summon(p: Player, ctx: GameContext, pid: string, damage: number, kb: number): void {
    const mine = ctx.entities.projectiles.filter((pr) => pr.o.owner === p && pr.def.behavior === 'minion' && !pr.removed);
    const slots = Math.max(1, p.stats.minionSlots);
    while (mine.length >= slots) {
      const old = mine.shift()!;
      old.removed = true;
      ctx.particles.emit(old.cx, old.cy, { count: 10, color: old.def.color, glow: true });
    }
    ctx.spawnProjectile(pid, p.input.aimX, p.input.aimY, 0, 0, { damage, knockback: kb, friendly: true, owner: p, critChance: BASE_CRIT, damageClass: 'summon' });
    ctx.particles.emit(p.input.aimX, p.input.aimY, { count: 20, color: ItemRegistry.projectile(pid)?.color ?? '#fff', glow: true, speed: [1, 3], gravity: 0 });
  }

  private tickSwing(p: Player, ctx: GameContext): void {
    const def = this.item!;
    const t = 1 - this.timer / this.max;
    this.angle = this.swingWorldAngle(t);
    const w = def.weapon;
    if (!w) return;
    const reach = (w.reach ?? 30) * 1.35;
    const sx = p.cx;
    const sy = p.cy - 6;
    const ex = sx + Math.cos(this.angle) * reach;
    const ey = sy + Math.sin(this.angle) * reach;
    const st = p.stats;
    const bonus = st.damage + st.meleeDamage;
    for (const e of ctx.entities.enemies) {
      if (e.dead || e.removed || !e.hittable || this.hitIds.has(e.id)) continue;
      const r = e.rect();
      if (!segmentHitsRect(sx, sy, ex, ey, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 })) continue;
      this.hitIds.add(e.id);
      const dealt = e.hurt(ctx, {
        damage: w.damage * (1 + bonus),
        knockback: w.knockback,
        dirX: this.facing,
        critChance: BASE_CRIT + (w.crit ?? 0) + st.crit,
        kind: 'melee',
        source: p,
        buff: w.onHit,
      });
      if (dealt > 0) {
        ctx.audio.play('hit', { x: e.cx, y: e.cy });
        ctx.particles.sparks((sx + ex) / 2, (sy + ey) / 2, '#ffffff', 4);
        if (def.category !== 'tool') ctx.shake(0.04);
      }
    }
    // Swings cut grass, vines and urns along the blade.
    if (this.timer % 3 === 0) {
      for (let k = 0.4; k <= 1; k += 0.3) {
        const tx = Math.floor((sx + (ex - sx) * k) / 16);
        const ty = Math.floor((sy + (ey - sy) * k) / 16);
        if (TileRegistry.cuttable[ctx.world.getFg(tx, ty)]) breakTile(ctx, tx, ty);
      }
    }
  }

  /** Arm/held pose for the renderer, in the player's local (facing-right) space. */
  pose(p: Player): { armAngle: number | null; held: { id: string; style: 'swing' | 'hold' | 'aim' | 'thrust'; angle: number; scale?: number } | null } {
    if (!this.active || !this.item) return { armAngle: null, held: null };
    const local = p.facing > 0 ? this.angle : Math.PI - this.angle;
    const id = this.item.id;
    switch (this.style) {
      case 'swing':
        // Scale the sprite so the drawn blade matches the weapon's hit reach.
        const scale = Math.max(1.2, ((this.item.weapon?.reach ?? 30) * 1.35) / 24);
        return { armAngle: local - Math.PI / 2, held: this.item.placeTile || this.item.placeWall ? null : { id, style: 'swing', angle: local, scale } };
      case 'aim': {
        const diagonal = ['wand', 'staff', 'sword', 'broadsword', 'boomerang'].includes(this.item.icon.t);
        return { armAngle: local - Math.PI / 2, held: this.item.icon.t === 'tome' ? { id, style: 'hold', angle: 0 } : { id, style: 'aim', angle: local + (diagonal ? Math.PI / 4 : 0) } };
      }
      case 'thrust':
        return { armAngle: local - Math.PI / 2, held: null };
      case 'hold':
        return { armAngle: -2.4, held: { id, style: 'hold', angle: 0 } };
      default:
        return { armAngle: null, held: null };
    }
  }
}

/** Apply a consumable's effects. Returns true if it was used (and consumed). */
export function useConsumable(p: Player, ctx: GameContext, def: ItemDef): boolean {
  const c = def.consumable!;
  if (c.sickness && p.buffs.has('potion_sickness')) {
    ctx.message('You still feel queasy from the last draught.', '#ffb070');
    return false;
  }
  if (c.maxLifeUp && p.baseLife >= 400) {
    ctx.message('Your heart can grow no stronger.', '#ffb070');
    return false;
  }
  if (c.maxManaUp && p.baseMana >= 200) {
    ctx.message('Your mind can hold no more mana.', '#ffb070');
    return false;
  }
  if (!p.cheats.infinite && !p.inventory.consume(def.id, 1)) return false;
  if (c.maxLifeUp) {
    p.baseLife += c.maxLifeUp;
    p.refreshStats();
    ctx.audio.play('powerup');
    ctx.message(`Maximum health increased to ${p.maxLife}!`, '#ff5a7a');
  }
  if (c.maxManaUp) {
    p.baseMana += c.maxManaUp;
    p.refreshStats();
    ctx.audio.play('powerup');
    ctx.message(`Maximum mana increased to ${p.maxMana}!`, '#6a8aff');
  }
  if (c.heal) p.heal(ctx, c.heal);
  if (c.mana) {
    p.mana = Math.min(p.maxMana, p.mana + c.mana);
    ctx.text.add(`+${c.mana}`, p.cx, p.y - 14, '#6a8aff', 10);
  }
  if (c.sickness) p.buffs.add('potion_sickness', 60 * 45);
  for (const b of c.buffs ?? []) p.buffs.add(b.id, b.seconds * 60);
  if (c.recall) recall(p, ctx);
  if (!c.maxLifeUp && !c.maxManaUp) ctx.audio.play('drink');
  return true;
}

export function recall(p: Player, ctx: GameContext): void {
  ctx.particles.emit(p.cx, p.cy, { count: 30, colors: ['#6fe0d0', '#ffffff'], speed: [1, 3], glow: true, gravity: -0.02 });
  ctx.audio.play('teleport');
  p.teleportTo(ctx, p.spawnX, p.spawnY);
  ctx.particles.emit(p.cx, p.cy, { count: 30, colors: ['#6fe0d0', '#ffffff'], speed: [1, 3], glow: true, gravity: -0.02 });
}

function useBucket(p: Player, ctx: GameContext, def: ItemDef, tx: number, ty: number): boolean {
  const l = def.liquid!;
  const w = ctx.world;
  const slot = p.inventory.selected;
  if (l.action === 'collect') {
    const amt = w.getLiquid(tx, ty);
    const type = w.getLiquidType(tx, ty);
    if (amt < 128) return false;
    w.setLiquid(tx, ty, 0, 0);
    ctx.bus.emit('worldEdit', { op: 'liquid', x: tx, y: ty, amount: 0, type: 0 });
    p.inventory.main.set(slot, { id: type === LIQUID.lava ? 'lava_bucket' : 'water_bucket', count: 1 });
    ctx.audio.play('splash', { x: tx * 16, y: ty * 16 });
    return true;
  }
  if (w.isSolid(tx, ty) || w.getLiquid(tx, ty) > 0) return false;
  w.setLiquid(tx, ty, 255, l.type);
  ctx.bus.emit('worldEdit', { op: 'liquid', x: tx, y: ty, amount: 255, type: l.type });
  p.inventory.main.set(slot, { id: 'bucket', count: 1 });
  ctx.audio.play('splash', { x: tx * 16, y: ty * 16 });
  return true;
}

/** Quick-use the best potion of a kind (H / J keys). */
export function quickUse(p: Player, ctx: GameContext, kind: 'heal' | 'mana'): void {
  let best: ItemDef | null = null;
  for (const s of p.inventory.main.slots) {
    if (!s) continue;
    const d = ItemRegistry.get(s.id);
    const v = kind === 'heal' ? d.consumable?.heal : d.consumable?.mana;
    if (!v || d.consumable?.maxLifeUp || d.consumable?.maxManaUp) continue;
    const bv = best ? (kind === 'heal' ? best.consumable!.heal! : best.consumable!.mana!) : 0;
    if (v > bv) best = d;
  }
  if (best) useConsumable(p, ctx, best);
  else ctx.message(kind === 'heal' ? 'No healing draughts.' : 'No mana tonics.', '#ffb070');
}
