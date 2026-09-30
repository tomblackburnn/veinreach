import type { GameContext } from '../../../core/context';
import type { Enemy } from '../Enemy';

export interface AIController {
  update(e: Enemy, ctx: GameContext): void;
  onHurt?(e: Enemy, ctx: GameContext): void;
  onDeath?(e: Enemy, ctx: GameContext): void;
  render?(g: CanvasRenderingContext2D, e: Enemy, ctx: GameContext): void;
  /** Runs on mirrors of another player's creature (no AI), e.g. to rebuild a worm body. */
  puppetUpdate?(e: Enemy, ctx: GameContext): void;
}
