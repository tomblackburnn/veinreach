import type { GameContext } from '../core/context';
import type { Entity } from './Entity';

/** Anything a creature can chase: the local player or another player's avatar. */
export type PlayerTarget = Entity & { readonly dead: boolean };

/**
 * The nearest living player to a point (local or remote). Creatures chase
 * whoever is closest, so in multiplayer they fight everyone, not just the
 * player whose game runs them. Falls back to the local player when nobody
 * is alive, so callers can still check `.dead`.
 */
export function nearestPlayer(ctx: GameContext, x: number, y: number): PlayerTarget {
  let best: PlayerTarget = ctx.player;
  let bd = ctx.player.dead ? Infinity : Math.hypot(ctx.player.cx - x, ctx.player.cy - y);
  for (const r of ctx.entities.remotes as PlayerTarget[]) {
    if (r.dead || r.removed) continue;
    const d = Math.hypot(r.cx - x, r.cy - y);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}
