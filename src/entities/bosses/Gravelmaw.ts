import { Boss } from './Boss';
import type { GameContext } from '../../core/context';
import { BOSS_MAP } from '../../data/bosses';
import { moveBody, rectHitsSolid } from '../../physics/Physics';
import { PHYSICS } from '../../core/config';
import { approach } from '../../utils/math';
import { shade } from '../../utils/color';

/**
 * Gravelmaw, the Burrowing Tyrant.
 * Attacks: stalk, telegraphed charge (stuns on walls, shaking rocks loose),
 * leap + shockwave, rock-spit volley, and a burrow ambush telegraphed by a dust
 * trail. Phase 2 (≤50%): faster, double charges, bigger volleys, grubling adds.
 */
export class Gravelmaw extends Boss {
  private chargeDir = 1;
  private chargesLeft = 0;

  constructor(x: number, y: number) {
    super(BOSS_MAP.get('gravelmaw')!, x, y);
    this.noClip = true;
    this.hittable = false;
    this.shielded = 60;
  }

  private get p2(): boolean {
    return this.phase >= 2;
  }

  private groundBelow(ctx: GameContext, px: number, py: number): number {
    let ty = Math.floor(py / 16);
    while (ty < ctx.world.height - 1 && !ctx.world.isSolid(Math.floor(px / 16), ty)) ty++;
    return ty * 16;
  }

  protected think(ctx: GameContext): void {
    const pl = this.target;
    const t = this.attackT;
    switch (this.attack) {
      case 'intro': {
        this.vy = -5;
        this.y += this.vy;
        if (t % 4 === 0) ctx.particles.dust(this.cx, this.bottom, '#8a6a4a', 6);
        ctx.shake(0.06);
        if (!rectHitsSolid(ctx.world, this.x, this.y, this.w, this.h) || t > 120) {
          this.noClip = false;
          this.hittable = true;
          this.vy = -6;
          ctx.audio.play('bossRoar', { x: this.cx, y: this.cy });
          this.setAttack('stalk');
        }
        return;
      }
      case 'stalk': {
        const dir = Math.sign(pl.cx - this.cx) || 1;
        this.facing = dir > 0 ? 1 : -1;
        this.vx = approach(this.vx, dir * (this.p2 ? 2.4 : 1.6), 0.1);
        this.physics(ctx, true);
        if (t > (this.p2 ? 90 : 140) && this.onGround) this.setAttack(this.pick(['charge', 'leap', 'spit', 'burrow']));
        return;
      }
      case 'charge': {
        if (t < 45) {
          this.vx = approach(this.vx, 0, 0.3);
          this.facing = pl.cx > this.cx ? 1 : -1;
          if (t % 5 === 0) ctx.particles.dust(this.cx - this.facing * 30, this.bottom, '#8a7a6a', 3);
          if (t === 1) {
            ctx.audio.play('charge', { x: this.cx, y: this.cy });
            this.chargesLeft = this.p2 ? 1 : 0;
          }
          this.physics(ctx, false);
          return;
        }
        if (t === 45) {
          this.chargeDir = this.facing;
          ctx.audio.play('bossAttack', { x: this.cx, y: this.cy });
        }
        this.vx = this.chargeDir * (this.p2 ? 9 : 7.5);
        const res = this.physics(ctx, true);
        if (t % 3 === 0) ctx.particles.dust(this.cx - this.chargeDir * 30, this.bottom, '#9a8a7a', 2);
        if (res.hitX) {
          this.setAttack('stunned');
          ctx.shake(0.6);
          ctx.audio.play('explosion', { x: this.cx, y: this.cy, pitch: 0.6 });
          // Rocks shaken loose from the ceiling.
          for (let i = 0; i < (this.p2 ? 9 : 6); i++) {
            const x = pl.cx + (Math.random() - 0.5) * 500;
            ctx.spawnProjectile('boss_rock', x, pl.cy - 300 - Math.random() * 100, 0, 1, { damage: Math.round(this.damage * 0.7), knockback: 3, friendly: false, owner: this });
          }
        } else if (t > 130) {
          if (this.chargesLeft-- > 0) this.attackT = 20;
          else this.setAttack('stalk');
        }
        return;
      }
      case 'stunned':
        this.defense = 0;
        this.vx = approach(this.vx, 0, 0.5);
        this.physics(ctx, false);
        if (t % 10 === 0) ctx.particles.emit(this.cx, this.y, { count: 2, color: '#ffe070', speed: [0.5, 1], angle: -Math.PI / 2, spread: 1, glow: true });
        if (t > 80) {
          this.defense = this.bdef.defense;
          this.setAttack('stalk');
        }
        return;
      case 'leap': {
        if (t === 1) {
          this.vy = -12.5;
          this.vx = Math.max(-7, Math.min(7, (pl.cx - this.cx) / 55));
          ctx.audio.play('bossAttack', { x: this.cx, y: this.cy, pitch: 0.7 });
        }
        const res = this.physics(ctx, false);
        if (t > 10 && (res.landed || this.onGround)) {
          ctx.shake(0.7);
          ctx.audio.play('explosion', { x: this.cx, y: this.cy });
          ctx.particles.dust(this.cx, this.bottom, '#8a7a6a', 30);
          this.hazards.push({ kind: 'burst', x: this.cx, y: this.bottom - 10, r: 90, warn: 0, active: 6, age: 0, damage: this.damage, color: '#c0a070' });
          const n = this.p2 ? 5 : 3;
          for (let i = 1; i <= n; i++) {
            for (const d of [-1, 1]) {
              ctx.spawnProjectile('boss_rock', this.cx + d * 30, this.bottom - 12, d * (1.5 + i * 1.3), -4 - i * 0.6, { damage: Math.round(this.damage * 0.6), knockback: 4, friendly: false, owner: this });
            }
          }
          this.setAttack('stalk');
        }
        return;
      }
      case 'spit': {
        this.vx = approach(this.vx, 0, 0.3);
        this.facing = pl.cx > this.cx ? 1 : -1;
        this.physics(ctx, false);
        const volleys = this.p2 ? 4 : 3;
        if (t % 22 === 0 && t / 22 <= volleys) {
          const a = this.angleToPlayer(ctx, this.cx + this.facing * 36, this.cy - 6) - 0.45;
          const n = this.p2 ? 6 : 4;
          for (let i = 0; i < n; i++) this.fire(ctx, 'boss_rock', this.cx + this.facing * 36, this.cy - 6, a + (i - n / 2) * 0.09, 6 + Math.random() * 3, 0.6);
          ctx.audio.play('stone', { x: this.cx, y: this.cy, pitch: 0.5 });
        }
        if (t > volleys * 22 + 30) this.setAttack('stalk');
        return;
      }
      case 'burrow': {
        if (t === 1) {
          ctx.audio.play('soil', { x: this.cx, y: this.cy, volume: 1, pitch: 0.5 });
          ctx.message('The ground trembles...', '#c0a070');
        }
        if (t < 40) {
          this.noClip = true;
          this.vy = 1.6;
          this.vx = 0;
          this.y += this.vy;
          if (t % 3 === 0) ctx.particles.dust(this.cx, this.bottom - 10, '#8a6a4a', 5);
          if (t > 20) {
            this.hittable = false;
            this.harmful = false;
          }
          return;
        }
        // Tunnel toward the player beneath the surface.
        const ground = this.groundBelow(ctx, pl.cx, pl.bottom);
        this.x = approach(this.x, pl.cx - this.w / 2, this.p2 ? 4 : 3);
        this.y = ground + 48;
        if (t % 3 === 0) {
          ctx.particles.dust(this.cx, this.groundBelow(ctx, this.cx, pl.y), '#8a6a4a', 3);
          ctx.shake(0.03);
        }
        if (t === 100) this.hazards.push({ kind: 'column', x: this.cx, y: ground, width: this.w, warn: 30, active: 0, age: 0, damage: 0, color: '#c0a070' });
        if (t >= 130) {
          this.y = ground - 8;
          this.vy = -13;
          this.vx = 0;
          this.hittable = true;
          this.harmful = true;
          ctx.shake(0.8);
          ctx.audio.play('bossRoar', { x: this.cx, y: this.cy, pitch: 1.2 });
          ctx.particles.dust(this.cx, ground, '#8a6a4a', 40);
          this.hazards.push({ kind: 'burst', x: this.cx, y: ground - 20, r: 70, warn: 0, active: 6, age: 0, damage: this.damage, color: '#c0a070' });
          if (this.p2) for (let i = 0; i < 2; i++) ctx.spawnEnemy('grubling', this.cx + (i ? 40 : -40), ground - 10);
          this.setAttack('erupt');
        }
        return;
      }
      case 'erupt': {
        this.vy = Math.min(this.vy + PHYSICS.gravity, PHYSICS.maxFall);
        this.y += this.vy;
        if (!rectHitsSolid(ctx.world, this.x, this.y, this.w, this.h)) this.noClip = false;
        if (!this.noClip) {
          this.physics(ctx, false);
          if (this.onGround) this.setAttack('stalk');
        }
        if (t > 200) {
          this.noClip = false;
          this.setAttack('stalk');
        }
        return;
      }
    }
  }

  private physics(ctx: GameContext, stepUp: boolean) {
    this.vy = Math.min(this.vy + PHYSICS.gravity, PHYSICS.maxFall);
    const res = moveBody(ctx.world, this, { platforms: false, stepUp });
    if (res.hitX && this.onGround && this.attack === 'stalk') this.vy = -9;
    return res;
  }

  protected override onPhase(ctx: GameContext, phase: number): void {
    super.onPhase(ctx, phase);
    ctx.message('Gravelmaw’s carapace cracks — it’s enraged!', '#ff8a4a');
    for (let i = 0; i < 3; i++) ctx.spawnEnemy('grubling', this.cx + (i - 1) * 40, this.bottom);
  }

  protected draw(g: CanvasRenderingContext2D, ctx: GameContext): void {
    if (this.attack === 'burrow' && this.attackT > 40) return;
    const [body, plate, dark, eye] = this.bdef.colors;
    const t = this.frameTime;
    const f = this.facing;
    g.translate(Math.round(this.cx), Math.round(this.bottom));
    g.scale(f * 1.28, 1.28);
    if (this.attack === 'charge' && this.attackT < 45) g.translate(Math.sin(t * 1.5) * 2, 0);
    const walk = this.onGround && Math.abs(this.vx) > 0.3 ? Math.sin(t * 0.3) * 3 : 0;
    const R = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    // Legs
    for (let i = 0; i < 3; i++) {
      const lx = -30 + i * 22;
      const o = (i % 2 ? walk : -walk);
      R(lx + o, -14, 6, 14, dark);
      R(lx + o - 3, -2, 10, 3, shade(dark, 0.7));
    }
    // Body dome with plates
    g.fillStyle = shade(body, 0.7);
    g.beginPath();
    g.ellipse(-4, -22, 46, 30, 0, Math.PI, 0);
    g.fill();
    g.fillRect(-50, -22, 92, 10);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(-6, -24, 42, 27, 0, Math.PI, 0);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? plate : shade(plate, 0.85);
      g.beginPath();
      g.ellipse(-34 + i * 16, -30 - Math.sin((i / 3) * Math.PI) * 14, 10, 14, -0.3 + i * 0.2, 0, Math.PI * 2);
      g.fill();
    }
    R(-48, -16, 92, 4, dark);
    // Cracks in phase 2
    if (this.phase >= 2) {
      g.strokeStyle = '#ff5a2a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-20, -44);
      g.lineTo(-10, -30);
      g.lineTo(-16, -20);
      g.moveTo(8, -46);
      g.lineTo(14, -34);
      g.stroke();
    }
    // Head with mandibles
    R(28, -34, 22, 22, shade(body, 0.85));
    R(28, -34, 22, 4, plate);
    const open = this.attack === 'spit' || this.attack === 'erupt' ? 6 + Math.sin(t * 0.5) * 3 : Math.sin(t * 0.08) * 2 + 2;
    g.fillStyle = plate;
    g.beginPath();
    g.moveTo(46, -30 - open * 0.3);
    g.lineTo(64, -34 - open);
    g.lineTo(52, -24);
    g.fill();
    g.beginPath();
    g.moveTo(46, -16 + open * 0.3);
    g.lineTo(64, -12 + open);
    g.lineTo(52, -22);
    g.fill();
    // Eyes
    R(40, -30, 4, 4, eye);
    R(34, -28, 3, 3, eye);
    if (this.attack === 'stunned') {
      for (let i = 0; i < 3; i++) {
        const a = t * 0.1 + (i * Math.PI * 2) / 3;
        R(30 + Math.cos(a) * 14, -56 + Math.sin(a) * 4, 3, 3, '#ffe070');
      }
    }
    void ctx;
  }
}
