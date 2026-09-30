import { Entity } from '../entities/Entity';
import type { GameContext } from '../core/context';
import type { Appearance } from '../entities/player/Appearance';
import { drawPlayer, type PlayerAnim } from '../rendering/sprites/playerSprite';
import { ItemRegistry } from '../items/ItemRegistry';
import type { PlayerState, PoseNet } from './protocol';

/** Another player's avatar, interpolated from network snapshots. */
export class RemotePlayer extends Entity {
  readonly kind = 'remote';
  private tx = 0;
  private ty = 0;
  anim: PlayerAnim = 'idle';
  held: string | null = null;
  armor: (string | null)[] = [null, null, null];
  life = 100;
  maxLife = 100;
  /** Weapon swing / aim, so attacks are visible. */
  pose: PoseNet | null = null;
  private t = 0;

  /** For creature targeting: remote players who are dead are ignored. */
  get dead(): boolean {
    return this.anim === 'dead' || this.life <= 0;
  }

  constructor(
    readonly netId: number,
    public name: string,
    public appearance: Appearance,
    x: number,
    y: number,
  ) {
    super(20, 42);
    this.x = this.tx = x;
    this.y = this.ty = y;
  }

  applyState(s: PlayerState): void {
    this.tx = s.x;
    this.ty = s.y;
    this.vx = s.vx;
    this.vy = s.vy;
    this.facing = s.facing;
    this.anim = (['idle', 'walk', 'jump', 'fall', 'climb', 'dead'].includes(s.anim) ? s.anim : 'idle') as PlayerAnim;
    this.held = s.held && ItemRegistry.has(s.held) ? s.held : null;
    this.armor = s.armor;
    this.life = s.life;
    this.maxLife = s.maxLife;
    const pose = s.pose;
    this.pose = Array.isArray(pose) && pose.length === 5 && (pose[1] === null || ItemRegistry.has(pose[1])) && ['swing', 'hold', 'aim', 'thrust'].includes(pose[2]) ? pose : null;
  }

  update(_ctx: GameContext): void {
    this.t++;
    // Extrapolate with velocity, then ease toward the last snapshot.
    this.tx += this.vx * 0.5;
    this.ty += this.vy * 0.5;
    this.x += (this.tx - this.x) * 0.3;
    this.y += (this.ty - this.y) * 0.3;
    if (Math.hypot(this.tx - this.x, this.ty - this.y) > 400) {
      this.x = this.tx;
      this.y = this.ty;
    }
  }

  render(g: CanvasRenderingContext2D): void {
    const arm = (i: number) => (this.armor[i] ? ItemRegistry.get(this.armor[i]!).armor : undefined);
    drawPlayer(g, this.cx, this.bottom, {
      appearance: this.appearance,
      armor: { head: arm(0), body: arm(1), legs: arm(2) },
      anim: this.anim,
      t: this.t,
      facing: this.facing,
      armAngle: this.pose ? this.pose[0] : null,
      held: this.pose?.[1]
        ? { id: this.pose[1], style: this.pose[2], angle: this.pose[3], scale: this.pose[4] }
        : this.held && ItemRegistry.get(this.held).heldLight ? { id: this.held, style: 'hold', angle: 0 } : null,
      alpha: this.anim === 'dead' ? 0.5 : 1,
    });
    g.font = 'bold 7px monospace';
    g.textAlign = 'center';
    g.fillStyle = '#000';
    g.fillText(this.name, this.cx + 1, this.y - 7);
    g.fillStyle = '#9fd0ff';
    g.fillText(this.name, this.cx, this.y - 8);
    const w = 24;
    g.fillStyle = '#300';
    g.fillRect(this.cx - w / 2, this.y - 4, w, 2);
    g.fillStyle = '#e8344a';
    g.fillRect(this.cx - w / 2, this.y - 4, (w * this.life) / Math.max(1, this.maxLife), 2);
  }

  override light() {
    return this.held && ItemRegistry.get(this.held).heldLight ? { x: this.cx, y: this.cy, r: 1, g: 0.78, b: 0.45, radius: 9 } : null;
  }
}
