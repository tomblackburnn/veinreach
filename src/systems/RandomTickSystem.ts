import type { GameContext } from '../core/context';
import { T, TileRegistry } from '../world/TileRegistry';
import { growTree, TREE_KIND } from '../generation/passes/vegetation';
import { FLAGS } from './ProgressionSystem';
import { growPlanter } from '../world/decor';

const TICKS_PER_FRAME = 60;
const RADIUS = 90;

/**
 * Random tile updates near the player: grass spread and regrowth, sapling
 * growth, Blightmire creep (halted once the Thornwarden falls) and
 * Shardblight creep after the Unsealing.
 */
export class RandomTickSystem {
  private tall = TileRegistry.id('tallgrass');
  private flower = TileRegistry.id('flower');
  private planter = TileRegistry.id('planter');

  update(ctx: GameContext): void {
    const w = ctx.world;
    const p = ctx.player;
    for (let i = 0; i < TICKS_PER_FRAME; i++) {
      const x = p.tileX + Math.floor((Math.random() * 2 - 1) * RADIUS);
      const y = p.tileY + Math.floor((Math.random() * 2 - 1) * RADIUS * 0.7);
      if (!w.inBounds(x, y)) continue;
      const id = w.getFg(x, y);
      if (id === this.planter) {
        growPlanter(ctx, x, y);
        continue;
      }
      if (id === T.sapling) {
        if (Math.random() < 0.02) this.growSapling(ctx, x, y);
        continue;
      }
      if (id === T.loam && w.getFg(x, y - 1) === 0 && Math.random() < 0.15) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const n = w.getFg(x + dx, y + dy);
          if (n === T.meadowgrass || n === T.blightgrass || n === T.shardgrass) {
            w.setFg(x, y, n, 0);
            break;
          }
        }
        continue;
      }
      if (id === T.meadowgrass && w.getFg(x, y - 1) === 0 && w.getLiquid(x, y - 1) === 0 && Math.random() < 0.01) {
        w.setFg(x, y - 1, Math.random() < 0.15 ? this.flower : this.tall, Math.floor(Math.random() * 4));
        continue;
      }
      // Blight creep onto meadow grass (stopped once the Thornwarden is defeated).
      if (id === T.blightgrass && !ctx.progression.has(FLAGS.thornwarden) && Math.random() < 0.05) {
        const nx = x + (Math.random() < 0.5 ? -1 : 1);
        const ny = y + Math.floor(Math.random() * 3) - 1;
        if (w.getFg(nx, ny) === T.meadowgrass) w.setFg(nx, ny, T.blightgrass, 0);
        continue;
      }
      // Shardblight creep after the Unsealing.
      if ((id === T.shardgrass || id === T.shardrock) && ctx.progression.has(FLAGS.unsealed) && Math.random() < 0.03) {
        const nx = x + Math.floor(Math.random() * 3) - 1;
        const ny = y + Math.floor(Math.random() * 3) - 1;
        const n = w.getFg(nx, ny);
        if (n === T.meadowgrass || n === T.blightgrass) w.setFg(nx, ny, T.shardgrass, 0);
        else if (n === T.stone || n === T.blightrock) w.setFg(nx, ny, T.shardrock, 0);
      }
    }
  }

  private growSapling(ctx: GameContext, x: number, y: number): void {
    const w = ctx.world;
    const ground = w.getFg(x, y + 1);
    const kind =
      ground === T.sand ? TREE_KIND.palm : ground === T.snow ? TREE_KIND.pine : ground === T.lumenmoss ? TREE_KIND.mushroom : ground === T.blightgrass ? TREE_KIND.dead : ground === T.shardgrass ? TREE_KIND.shard : TREE_KIND.oak;
    w.setFg(x, y, 0, 0);
    const h = kind === TREE_KIND.mushroom ? 5 + Math.floor(Math.random() * 4) : 6 + Math.floor(Math.random() * 5);
    if (!growTree(w, x, y + 1, kind, h)) w.setFg(x, y, T.sapling, 0);
  }
}
