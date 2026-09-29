import { Actor, type HitInfo } from '../Actor';
import type { GameContext } from '../../core/context';
import { PlayerInventory } from '../../inventory/PlayerInventory';
import { computeStats, type ComputedStats } from './PlayerStats';
import { type Appearance, type Difficulty, defaultAppearance } from './Appearance';
import { PHYSICS, PLAYER_TUNING as PT, TILE_SIZE } from '../../core/config';
import { moveBody, liquidAt, tileContact, unstick, rectHitsSolid } from '../../physics/Physics';
import { findStandSpot } from '../../world/locate';
import { approach, clamp } from '../../utils/math';
import { fallDamage, applyReduction } from '../../combat/damage';
import { ItemUse } from '../../combat/ItemUse';
import { drawPlayer, type PlayerAnim } from '../../rendering/sprites/playerSprite';
import { ItemRegistry } from '../../items/ItemRegistry';
import type { ItemDrop } from '../ItemDrop';
import type { Entity, LightSource } from '../Entity';
import { toggleDoor } from '../../world/WorldActions';
import { T } from '../../world/TileRegistry';
import { emptyStats } from '../../items/stats';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  use: boolean;
  usePressed: boolean;
  aimX: number;
  aimY: number;
}

export const emptyInput = (): PlayerInput => ({ left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, use: false, usePressed: false, aimX: 0, aimY: 0 });

/** The local player character: movement physics, stats, item use and death/respawn. */
export class Player extends Actor {
  readonly kind = 'player';
  readonly team = 'player';
  charId = '';
  name = 'Wanderer';
  appearance: Appearance = defaultAppearance();
  difficulty: Difficulty = 'wanderer';
  readonly inventory = new PlayerInventory();
  baseLife: number = PT.baseLife;
  baseMana: number = PT.baseMana;
  mana: number = PT.baseMana;
  maxMana: number = PT.baseMana;
  stats: ComputedStats = { ...emptyStats(), setBonus: null };
  input: PlayerInput = emptyInput();
  readonly use = new ItemUse();
  /** Creative-mode toggles (see ui/panels/CreativePanel). */
  readonly cheats = { god: false, fly: false, instantMine: false, infinite: false };

  // Movement state
  private jumpHold = 0;
  private coyote = 0;
  private doubleJumpUsed = false;
  private dashCd = 0;
  private dashTicks = 0;
  private lastTap = { dir: 0, tick: -100 };
  private prevLeft = false;
  private prevRight = false;
  climbing = false;
  private dropThrough = 0;
  private fallStartY = 0;
  private wasGround = true;
  private stepTimer = 0;
  private liquid = 0;
  private lavaTimer = 0;
  private wasFlying = false;

  // Regen & timers
  sinceHurt = 600;
  private manaDelay = 0;
  private lifeAcc = 0;
  private manaAcc = 0;
  respawnTimer = 0;
  spawnX = 0;
  spawnY = 0;
  anim: PlayerAnim = 'idle';
  animT = 0;
  deaths = 0;
  playTicks = 0;
  /** Set when the character suffers a permanent (Ironsoul) death. */
  permadead = false;
  private statsVersion = -1;
  private statTimer = 0;

  constructor() {
    super(PT.width, PT.height);
    this.life = this.maxLife = PT.baseLife;
  }

  get tileX(): number {
    return Math.floor(this.cx / TILE_SIZE);
  }

  get tileY(): number {
    return Math.floor(this.cy / TILE_SIZE);
  }

  refreshStats(): void {
    this.stats = computeStats(this.inventory, this.buffs);
    this.maxLife = Math.min(PT.maxLifeCap + 100, this.baseLife + this.stats.maxLife);
    this.maxMana = Math.min(PT.maxManaCap + 200, this.baseMana + this.stats.maxMana);
    this.defense = Math.max(0, this.stats.defense);
    this.kbResist = this.stats.knockbackImmune > 0 ? 1 : 0;
    this.life = Math.min(this.life, this.maxLife);
    this.mana = Math.min(this.mana, this.maxMana);
  }

  private statsKey(): number {
    const i = this.inventory;
    return i.armor.version * 1000003 + i.accessories.version * 1009 + this.buffs.version;
  }

  update(ctx: GameContext): void {
    this.age++;
    this.animT++;
    if (this.dead) {
      this.updateDead(ctx);
      return;
    }
    this.playTicks++;
    const key = this.statsKey();
    if (key !== this.statsVersion || ++this.statTimer > 60) {
      this.statsVersion = key;
      this.statTimer = 0;
      this.refreshStats();
    }
    this.tickStatus(ctx, (id) => (id === 'burning' && this.stats.fireImmune > 0) || (id === 'poisoned' && this.stats.poisonImmune > 0));
    if (this.dead) return;
    this.regen(ctx);
    this.move(ctx);
    this.environment(ctx);
    this.use.update(this, ctx);
    this.updateAnim();
    if (this.dashCd > 0) this.dashCd--;
  }

  private regen(ctx: GameContext): void {
    this.sinceHurt++;
    // Life: slow at first, ramping up the longer you avoid damage.
    let rate = this.stats.lifeRegen;
    if (this.sinceHurt > 300) rate += Math.min(3, 0.5 + (this.sinceHurt - 300) / 600);
    if (this.buffs.has('voidtouched')) rate = Math.min(rate, 0);
    this.lifeAcc += rate / 60;
    if (this.lifeAcc >= 1) {
      const n = Math.floor(this.lifeAcc);
      this.lifeAcc -= n;
      this.life = Math.min(this.maxLife, this.life + n);
    } else if (this.lifeAcc < -1) {
      this.lifeAcc = 0;
    }
    if (this.manaDelay > 0) this.manaDelay--;
    else {
      this.manaAcc += (this.maxMana * 0.08 + 3 + this.stats.manaRegen) / 60;
      if (this.manaAcc >= 1) {
        const n = Math.floor(this.manaAcc);
        this.manaAcc -= n;
        this.mana = Math.min(this.maxMana, this.mana + n);
      }
    }
    void ctx;
  }

  spendMana(n: number): boolean {
    if (this.cheats.infinite) return true;
    if (this.mana < n) return false;
    this.mana -= n;
    this.manaDelay = 50;
    return true;
  }

  private move(ctx: GameContext): void {
    const inp = this.input;
    const st = this.stats;
    const prevLiquid = this.liquid;
    this.liquid = liquidAt(ctx.world, this);
    if (this.liquid !== prevLiquid && Math.abs(this.vy) > 1.5) {
      const col = (this.liquid || prevLiquid) === 2 ? '#ff8a3a' : '#8fc4ff';
      ctx.particles.splash(this.cx, this.bottom - 4, col);
      ctx.audio.play('splash', { x: this.cx, y: this.cy, volume: 0.7 });
    }
    const inWater = this.liquid !== 0;
    const slow = this.buffs.speedMul() * (inWater ? 0.55 : 1);
    const maxSpeed = PT.maxSpeed * (1 + st.moveSpeed) * slow;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const contact = tileContact(ctx.world, this);

    // Dash: double-tap a direction.
    const tapL = inp.left && !this.prevLeft;
    const tapR = inp.right && !this.prevRight;
    this.prevLeft = inp.left;
    this.prevRight = inp.right;
    if (tapL || tapR) {
      const d = tapR ? 1 : -1;
      if (st.dash > 0 && this.dashCd <= 0 && this.lastTap.dir === d && ctx.tick - this.lastTap.tick < 14) {
        this.vx = d * 10;
        this.dashTicks = 14;
        this.dashCd = 70;
        ctx.audio.play('swing', { x: this.cx, y: this.cy, pitch: 0.7 });
        ctx.particles.emit(this.cx, this.cy, { count: 12, colors: ['#ffffff', '#c0d0ff'], speed: [0.5, 2], angle: d > 0 ? Math.PI : 0, spread: 0.5, life: [10, 25], gravity: 0 });
      }
      this.lastTap = { dir: d, tick: ctx.tick };
    }

    // Creative flight: free movement through terrain.
    if (this.wasFlying && !this.cheats.fly && rectHitsSolid(ctx.world, this.x, this.y, this.w, this.h)) {
      const spot = findStandSpot(ctx.world, this.tileX, this.tileY, 40);
      if (spot) this.teleportTo(ctx, spot[0], spot[1]);
    }
    this.wasFlying = this.cheats.fly;
    if (this.cheats.fly) {
      const sp = inp.jump || inp.up ? -1 : inp.down ? 1 : 0;
      const fast = 1.8;
      this.vx = approach(this.vx, dir * maxSpeed * 2.4 * fast, 0.8);
      this.vy = approach(this.vy, sp * maxSpeed * 2.4 * fast, 0.8);
      if (dir) this.facing = dir > 0 ? 1 : -1;
      moveBody(ctx.world, this, { platforms: false, noClip: true });
      this.x = clamp(this.x, 0, ctx.world.width * 16 - this.w);
      this.y = clamp(this.y, 0, ctx.world.height * 16 - this.h);
      this.fallStartY = this.y;
      this.climbing = false;
      return;
    }

    // Climbing ropes.
    if (contact.climb && (inp.up || inp.down) && !inp.jump) this.climbing = true;
    if (!contact.climb || inp.jumpPressed) this.climbing = false;
    if (this.climbing) {
      this.vy = inp.up ? -2.6 : inp.down ? 2.6 : 0;
      this.vx = approach(this.vx, dir * 1.5, 0.4);
      // Snap to rope centre.
      const ropeX = Math.floor(this.cx / 16) * 16 + 8;
      if (ctx.world.getFg(Math.floor(this.cx / 16), Math.floor(this.cy / 16)) === T.rope) this.x += (ropeX - this.cx) * 0.3;
      this.fallStartY = this.y;
      this.doubleJumpUsed = false;
      moveBody(ctx.world, this, { platforms: true, dropThrough: true });
      return;
    }

    // Horizontal.
    if (this.dashTicks > 0) {
      this.dashTicks--;
      if (this.age % 2 === 0) ctx.particles.emit(this.cx, this.bottom - 4, { count: 1, color: '#ffffff', speed: [0, 0.5], life: [10, 20], gravity: 0 });
    } else if (dir !== 0) {
      const acc = (this.onGround ? PT.accel : PT.airAccel) * (1 + st.moveSpeed * 0.5);
      if (Math.sign(this.vx) !== dir && this.onGround) this.vx = approach(this.vx, 0, PT.friction * 1.5);
      this.vx = approach(this.vx, dir * maxSpeed, acc);
      if (!this.use.active || this.use.style === 'hold') this.facing = dir > 0 ? 1 : -1;
    } else {
      this.vx = approach(this.vx, 0, this.onGround ? PT.friction : 0.06);
    }
    if (Math.abs(this.vx) > maxSpeed && this.dashTicks <= 0) this.vx = approach(this.vx, Math.sign(this.vx) * maxSpeed, 0.2);
    this.vx *= contact.drag;

    // Jumping.
    if (this.onGround) {
      this.coyote = 6;
      this.doubleJumpUsed = false;
    } else if (this.coyote > 0) this.coyote--;
    const jumpV = PT.jumpSpeed * (1 + st.jumpBoost * 0.45);
    if (inp.jumpPressed) {
      if (this.coyote > 0 || (inWater && this.vy > -2)) {
        this.vy = -jumpV * (inWater ? 0.75 : 1);
        this.jumpHold = PT.jumpHoldTicks;
        this.coyote = 0;
        ctx.audio.play('jump', { volume: 0.5 });
      } else if (st.doubleJump > 0 && !this.doubleJumpUsed) {
        this.doubleJumpUsed = true;
        this.vy = -jumpV * 0.9;
        this.jumpHold = PT.jumpHoldTicks - 4;
        this.fallStartY = this.y;
        ctx.audio.play('jump', { pitch: 1.4 });
        ctx.particles.emit(this.cx, this.bottom, { count: 14, colors: ['#ffffff', '#dfefff'], speed: [0.5, 2], angle: Math.PI / 2, spread: 1.4, life: [15, 30], size: [2, 4], gravity: 0.02 });
      }
    }
    if (!inp.jump) this.jumpHold = 0;
    let grav = PHYSICS.gravity * (inWater ? PHYSICS.liquidGravityScale : 1);
    if (this.jumpHold > 0 && this.vy < 0) {
      this.jumpHold--;
      grav *= PT.jumpHoldGravityScale;
    }
    if (this.dashTicks > 0) grav *= 0.3;
    this.vy = Math.min(this.vy + grav, inWater ? PHYSICS.liquidMaxFall : PHYSICS.maxFall);
    this.vy *= contact.drag < 1 ? 0.6 : 1;

    // Platforms: hold down to drop through.
    if (inp.down && this.onGround) this.dropThrough = 10;
    if (this.dropThrough > 0) this.dropThrough--;

    const res = moveBody(ctx.world, this, { platforms: true, dropThrough: this.dropThrough > 0, stepUp: true });
    // Walk into closed doors to open them.
    if (res.hitX && dir !== 0) {
      const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / 16);
      for (let ty = Math.floor(this.y / 16); ty <= Math.floor((this.bottom - 1) / 16); ty++) {
        if (ctx.world.getFg(tx, ty) === T.doorClosed) {
          toggleDoor(ctx, tx, ty);
          break;
        }
      }
    }

    // Fall damage.
    if (!this.onGround && this.wasGround) this.fallStartY = this.y;
    if (!this.onGround && this.vy < 0) this.fallStartY = Math.min(this.fallStartY, this.y);
    if (inWater) this.fallStartY = this.y;
    if (res.landed && !this.wasGround) {
      const tiles = (this.y - this.fallStartY) / 16;
      if (tiles > 3) {
        ctx.audio.play('land', { volume: Math.min(1, tiles / 10) });
        ctx.particles.dust(this.cx, this.bottom, '#8a7a6a', Math.min(10, Math.round(tiles)));
      }
      if (st.fallImmune <= 0) {
        const dmg = fallDamage(tiles, PT.fallDamageTiles);
        if (dmg > 0) this.hurt(ctx, { damage: dmg, knockback: 0, dirX: 0, ignoreDefense: true, kind: 'environment', immunity: 20 });
      }
    }
    this.wasGround = this.onGround;
    // Footsteps
    if (this.onGround && Math.abs(this.vx) > 1) {
      this.stepTimer += Math.abs(this.vx);
      if (this.stepTimer > 36) {
        this.stepTimer = 0;
        ctx.audio.play('step', { volume: 0.6 });
      }
    }
    if (!this.cheats.fly) unstick(ctx.world, this);
  }

  private environment(ctx: GameContext): void {
    const contact = tileContact(ctx.world, this);
    if (contact.damage > 0 && this.immune <= 0) {
      this.hurt(ctx, { damage: contact.damage, knockback: 4, dirX: -this.facing, kind: 'environment', immunity: 40 });
    }
    if (this.liquid === 2) {
      if (this.stats.lavaImmune <= 0) {
        if (this.lavaTimer <= 0) {
          this.hurt(ctx, { damage: 45, knockback: 3, dirX: -this.facing, kind: 'environment', immunity: 30 });
          this.buffs.add('burning', 60 * 7);
          this.lavaTimer = 30;
        }
      }
      if (ctx.tick % 4 === 0) ctx.particles.emit(this.cx, this.cy, { count: 2, colors: ['#ff6a2a', '#ffb040'], speed: [0.5, 1.5], angle: -Math.PI / 2, spread: 0.6, glow: true });
    } else if (this.liquid === 1) {
      this.buffs.remove('burning');
    }
    if (this.lavaTimer > 0) this.lavaTimer--;
    // Campfire proximity
    if (ctx.tick % 60 === 0) {
      const tx = this.tileX;
      const ty = this.tileY;
      let cozy = false;
      for (let y = ty - 6; y <= ty + 6 && !cozy; y++) for (let x = tx - 10; x <= tx + 10 && !cozy; x++) if (ctx.world.getFg(x, y) === 69) cozy = true;
      if (cozy) this.buffs.add('campfire', 90);
    }
  }

  private updateAnim(): void {
    let a: PlayerAnim = 'idle';
    if (this.climbing) a = 'climb';
    else if (!this.onGround) a = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 0.3) a = 'walk';
    this.anim = a;
  }

  protected override modifyIncoming(amount: number): number {
    return applyReduction(amount, this.stats.damageReduce);
  }

  override hurt(ctx: GameContext, h: HitInfo): number {
    if (this.cheats.god) return 0;
    if (h.immunity === undefined) h.immunity = PT.invulnTicks;
    return super.hurt(ctx, h);
  }

  protected onHurt(ctx: GameContext, amount: number, h: HitInfo): void {
    this.sinceHurt = 0;
    ctx.audio.play('playerHurt');
    ctx.shake(Math.min(0.35, 0.1 + amount / 150));
    ctx.particles.emit(this.cx, this.cy, { count: 8, colors: ['#c02020', '#801010'], speed: [1, 3], life: [15, 30] });
    // Thorns
    const src = h.source as (Entity & { hurt?: Actor['hurt'] }) | null | undefined;
    if (this.stats.thorns > 0 && src && src !== this && typeof src.hurt === 'function' && h.kind === 'contact') {
      src.hurt(ctx, { damage: Math.round(amount * this.stats.thorns * 2), knockback: 3, dirX: Math.sign(src.cx - this.cx) || 1, source: this });
    }
  }

  /** Hook for enemy contact (unused by default). */
  onContactWith(_ctx: GameContext, _e: Entity): void {}

  protected onDeath(ctx: GameContext, h: HitInfo): void {
    this.deaths++;
    this.respawnTimer = PT.respawnTicks;
    this.use.cancel();
    this.buffs.clear();
    ctx.audio.play('playerDie');
    ctx.shake(0.5);
    ctx.particles.emit(this.cx, this.cy, { count: 40, colors: ['#c02020', '#801010', this.appearance.shirtColor], speed: [1, 5], life: [30, 60], gravity: 0.2 });
    // Death penalties by difficulty.
    if (this.difficulty === 'wanderer') {
      const lost = Math.floor(this.inventory.wallet / 2);
      if (lost > 0) {
        this.inventory.wallet -= lost;
        ctx.dropItem({ id: 'aurel', count: lost }, this.cx, this.cy, 0, -2, 120);
      }
    } else if (this.difficulty === 'delver') {
      for (let i = 0; i < this.inventory.main.size; i++) {
        const s = this.inventory.main.get(i);
        if (s) ctx.dropItem({ ...s }, this.cx, this.cy, (Math.random() - 0.5) * 6, -3 - Math.random() * 3, 180);
        this.inventory.main.set(i, null);
      }
      if (this.inventory.wallet > 0) ctx.dropItem({ id: 'aurel', count: this.inventory.wallet }, this.cx, this.cy, 0, -2, 180);
      this.inventory.wallet = 0;
    } else if (this.difficulty === 'ironsoul') {
      this.permadead = true;
    }
    const cause = h.source && 'name' in h.source ? String((h.source as { name: string }).name) : h.kind === 'environment' ? 'the world' : 'misfortune';
    ctx.bus.emit('playerDied', { cause });
  }

  private updateDead(ctx: GameContext): void {
    if (this.permadead) return;
    this.respawnTimer--;
    if (this.respawnTimer <= 0) this.respawn(ctx);
  }

  respawn(ctx: GameContext): void {
    this.dead = false;
    this.life = this.maxLife;
    this.mana = this.maxMana;
    this.immune = 120;
    this.vx = this.vy = 0;
    this.teleportTo(ctx, this.spawnX, this.spawnY);
  }

  /** Teleport so the player's feet stand on tile row `ty`. */
  teleportTo(ctx: GameContext, tx: number, ty: number): void {
    this.x = tx * 16 + 8 - this.w / 2;
    this.y = (ty + 1) * 16 - this.h;
    this.fallStartY = this.y;
    unstick(ctx.world, this);
    ctx.camera.snap(this.cx, this.cy);
  }

  pickup(ctx: GameContext, drop: ItemDrop): void {
    const left = this.inventory.give(drop.stack);
    const got = drop.stack.count - left;
    if (got > 0) {
      const def = ItemRegistry.get(drop.stack.id);
      ctx.audio.play(drop.stack.id === 'aurel' ? 'coin' : 'pickup', { volume: 0.7 });
      ctx.text.add(`${def.name}${got > 1 ? ` (${got})` : ''}`, this.cx, this.y - 10, drop.stack.id === 'aurel' ? '#f5cf3c' : '#e8e8e8', 8, 40);
      ctx.bus.emit('pickup', { id: drop.stack.id, count: got });
    }
    if (left <= 0) drop.removed = true;
    else drop.stack.count = left;
  }

  override light(): LightSource | null {
    const held = this.inventory.heldItem();
    const hl = held ? ItemRegistry.get(held.id).heldLight : undefined;
    const r = this.stats.lightRadius;
    if (hl) return { x: this.cx + this.facing * 8, y: this.cy - 6, r: hl[0], g: hl[1], b: hl[2], radius: 9 };
    if (r > 0) return { x: this.cx, y: this.cy, r: 0.55 * r, g: 0.7 * r, b: 0.9 * r, radius: 7 };
    return null;
  }

  render(g: CanvasRenderingContext2D, ctx: GameContext): void {
    if (this.dead && this.permadead) return;
    const armor = {
      head: this.inventory.armor.get(0) ? ItemRegistry.get(this.inventory.armor.get(0)!.id).armor : undefined,
      body: this.inventory.armor.get(1) ? ItemRegistry.get(this.inventory.armor.get(1)!.id).armor : undefined,
      legs: this.inventory.armor.get(2) ? ItemRegistry.get(this.inventory.armor.get(2)!.id).armor : undefined,
    };
    const pose = this.use.pose(this);
    const held = this.inventory.heldItem();
    const heldDef = held ? ItemRegistry.get(held.id) : null;
    const showTorch = !pose.held && heldDef?.heldLight;
    drawPlayer(g, this.cx, this.bottom, {
      appearance: this.appearance,
      armor,
      anim: this.dead ? 'dead' : this.anim,
      t: this.animT,
      facing: this.facing,
      armAngle: pose.armAngle ?? (showTorch ? -0.9 : null),
      held: pose.held ?? (showTorch ? { id: held!.id, style: 'hold', angle: 0 } : null),
      flash: this.hitFlash > 0 && this.hitFlash % 4 < 2,
      alpha: this.immune > 0 && !this.dead && this.immune % 8 < 4 ? 0.55 : 1,
    });
    void ctx;
  }
}
