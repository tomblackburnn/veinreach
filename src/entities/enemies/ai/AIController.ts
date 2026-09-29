import type { GameContext } from '../../../core/context';
import type { Enemy } from '../Enemy';

export interface AIController {
  update(e: Enemy, ctx: GameContext): void;
  onHurt?(e: Enemy, ctx: GameContext): void;
  onDeath?(e: Enemy, ctx: GameContext): void;
  render?(g: CanvasRenderingContext2D, e: Enemy, ctx: GameContext): void;
}
