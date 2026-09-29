import type { Entity, LightSource } from './Entity';
import type { Enemy } from './enemies/Enemy';
import type { Projectile } from './Projectile';
import type { ItemDrop } from './ItemDrop';
import type { NPC } from './npcs/NPC';
import type { Player } from './player/Player';
import type { GameContext } from '../core/context';

const MARGIN = 64;

/** Owns every live entity, grouped by kind for fast queries. */
export class EntityManager {
  players: Player[] = [];
  remotes: Entity[] = [];
  enemies: Enemy[] = [];
  npcs: NPC[] = [];
  projectiles: Projectile[] = [];
  drops: ItemDrop[] = [];

  add(e: Entity): void {
    switch (e.kind) {
      case 'player':
        this.players.push(e as Player);
        break;
      case 'remote':
        this.remotes.push(e);
        break;
      case 'enemy':
        this.enemies.push(e as Enemy);
        break;
      case 'npc':
        this.npcs.push(e as NPC);
        break;
      case 'projectile':
        this.projectiles.push(e as Projectile);
        break;
      case 'drop':
        this.drops.push(e as ItemDrop);
        break;
    }
  }

  update(ctx: GameContext): void {
    const run = <T extends Entity>(list: T[]): T[] => {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.removed) {
          try {
            e.update(ctx);
          } catch (err) {
            console.error(`[Entities] ${e.kind} update failed; removing`, err);
            e.removed = true;
          }
        }
      }
      return list.some((e) => e.removed) ? list.filter((e) => !e.removed) : list;
    };
    this.players = run(this.players);
    this.npcs = run(this.npcs);
    this.enemies = run(this.enemies);
    this.projectiles = run(this.projectiles);
    this.drops = run(this.drops);
    this.remotes = run(this.remotes);
  }

  render(g: CanvasRenderingContext2D, ctx: GameContext, l: number, t: number, r: number, b: number): void {
    const vis = (e: Entity) => e.x + e.w > l - MARGIN && e.x < r + MARGIN && e.y + e.h > t - MARGIN && e.y < b + MARGIN;
    const draw = (list: Entity[]) => {
      for (const e of list) if (vis(e) || (e as Enemy).isBoss) e.render(g, ctx);
    };
    draw(this.npcs);
    draw(this.drops);
    // Draw worm bodies before heads, bosses last among enemies.
    const enemies = [...this.enemies].sort((a, b) => Number(!!b.head) - Number(!!a.head) || Number(a.isBoss) - Number(b.isBoss));
    draw(enemies);
    draw(this.remotes);
    draw(this.players);
    draw(this.projectiles);
  }

  nearestEnemy(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.removed || !e.hittable || (e.state === 'disguised')) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  lights(l: number, t: number, r: number, b: number): LightSource[] {
    const out: LightSource[] = [];
    const push = (e: Entity) => {
      if (e.x > r + 160 || e.x + e.w < l - 160 || e.y > b + 160 || e.y + e.h < t - 160) return;
      const s = e.light();
      if (s) out.push(s);
    };
    for (const list of [this.players, this.enemies, this.projectiles, this.drops, this.npcs, this.remotes] as Entity[][]) for (const e of list) push(e);
    return out;
  }

  /** Remove all hostile entities (death screen / debug). */
  clearHostile(): void {
    for (const e of this.enemies) e.removed = true;
    for (const p of this.projectiles) if (!p.friendly) p.removed = true;
  }

  get total(): number {
    return this.players.length + this.remotes.length + this.enemies.length + this.npcs.length + this.projectiles.length + this.drops.length;
  }
}
