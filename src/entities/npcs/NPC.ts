import { Actor, type HitInfo } from '../Actor';
import type { GameContext } from '../../core/context';
import type { NPCDef } from '../../data/npcs';
import { drawPlayer } from '../../rendering/sprites/playerSprite';
import { moveBody } from '../../physics/Physics';
import { PHYSICS } from '../../core/config';
import { approach } from '../../utils/math';
import { toggleDoor } from '../../world/WorldActions';
import { T } from '../../world/TileRegistry';

/** A friendly townsperson that lives in a player-built house. */
export class NPC extends Actor {
  readonly kind = 'npc';
  readonly team = 'npc';
  homeX: number | null = null;
  homeY: number | null = null;
  homeMinX = 0;
  homeMaxX = 0;
  private walkDir = 0;
  private walkTimer = 0;
  talking = 0;
  private animT = 0;

  constructor(
    readonly def: NPCDef,
    public name: string,
    x: number,
    y: number,
  ) {
    super(20, 42);
    this.x = x - 10;
    this.y = y - 42;
    this.life = this.maxLife = 250;
    this.defense = 15;
  }

  get displayName(): string {
    return `${this.name} the ${this.def.role}`;
  }

  update(ctx: GameContext): void {
    this.age++;
    this.animT++;
    this.tickStatus(ctx, () => false);
    if (this.talking > 0) {
      this.talking--;
      this.walkDir = 0;
      this.facing = ctx.player.cx > this.cx ? 1 : -1;
    } else if (--this.walkTimer <= 0) {
      this.walkTimer = 90 + Math.floor(Math.random() * 200);
      const night = ctx.time.isNight || !!ctx.worldEvents.active;
      this.walkDir = Math.random() < (night ? 0.75 : 0.4) ? 0 : Math.random() < 0.5 ? -1 : 1;
      // Head home when too far away (or at night).
      if (this.homeX !== null) {
        const hx = this.homeX * 16 + 8;
        const far = Math.abs(hx - this.cx) > (night ? 24 : 16 * 14);
        if (far) this.walkDir = Math.sign(hx - this.cx);
        else if (night && (this.tileX < this.homeMinX || this.tileX > this.homeMaxX)) this.walkDir = Math.sign(hx - this.cx);
      }
    }
    this.vx = approach(this.vx, this.walkDir * 1.1, 0.1);
    if (this.walkDir) this.facing = this.walkDir > 0 ? 1 : -1;
    this.vy = Math.min(this.vy + PHYSICS.gravity, PHYSICS.maxFall);
    const res = moveBody(ctx.world, this, { platforms: true, stepUp: true });
    if (res.hitX && this.walkDir) {
      const tx = Math.floor((this.walkDir > 0 ? this.x + this.w + 2 : this.x - 2) / 16);
      const ty = Math.floor((this.bottom - 8) / 16);
      if (ctx.world.getFg(tx, ty) === T.doorClosed) {
        toggleDoor(ctx, tx, ty);
        this.mem.closeDoor = 60;
        this.mem.doorX = tx;
        this.mem.doorY = ty;
      } else if (this.onGround && Math.random() < 0.02) this.vy = -6;
      else this.walkDir = -this.walkDir;
    }
    if (this.mem.closeDoor !== undefined && --this.mem.closeDoor <= 0) {
      toggleDoor(ctx, this.mem.doorX, this.mem.doorY, { open: false });
      delete this.mem.closeDoor;
    }
  }

  private mem: Record<string, number> = {};

  get tileX(): number {
    return Math.floor(this.cx / 16);
  }

  override hurt(ctx: GameContext, h: HitInfo): number {
    // Townsfolk are sturdy; they shrug off stray hits.
    return super.hurt(ctx, { ...h, damage: Math.min(h.damage, 10), immunity: 30 });
  }

  protected onHurt(ctx: GameContext): void {
    ctx.audio.play('playerHurt', { x: this.cx, y: this.cy, pitch: 1.3, volume: 0.5 });
  }

  protected onDeath(ctx: GameContext): void {
    // NPCs are knocked out rather than killed: they recover at home.
    this.dead = false;
    this.life = this.maxLife;
    ctx.message(`${this.displayName} was knocked out and retreats home to recover.`, '#ff9a9a');
    if (this.homeX !== null && this.homeY !== null) {
      this.x = this.homeX * 16 + 8 - this.w / 2;
      this.y = (this.homeY + 1) * 16 - this.h;
    }
  }

  render(g: CanvasRenderingContext2D, ctx: GameContext): void {
    const look = this.def.look;
    drawPlayer(g, this.cx, this.bottom, {
      appearance: look,
      armor: look.hat ? { head: { slot: 'head', defense: 0, color: look.hat, trim: look.hatTrim } } : {},
      anim: Math.abs(this.vx) > 0.2 ? 'walk' : this.onGround ? 'idle' : 'fall',
      t: this.animT,
      facing: this.facing,
      armAngle: this.talking > 0 ? -0.6 + Math.sin(this.animT * 0.2) * 0.3 : null,
      flash: this.hitFlash > 0,
    });
    const p = ctx.player;
    if (Math.abs(p.cx - this.cx) < 80 && Math.abs(p.cy - this.cy) < 60) {
      g.font = 'bold 7px "Pixel", monospace';
      g.textAlign = 'center';
      g.fillStyle = '#000';
      g.fillText(this.name, this.cx + 1, this.y - 7);
      g.fillStyle = '#ffe8a0';
      g.fillText(this.name, this.cx, this.y - 8);
    }
  }
}
