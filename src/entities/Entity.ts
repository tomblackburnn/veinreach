import type { GameContext } from '../core/context';
import type { Body } from '../physics/Physics';
import type { Rect } from '../utils/math';

export type EntityKind = 'player' | 'remote' | 'enemy' | 'npc' | 'projectile' | 'drop';

export interface LightSource {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  /** Radius in tiles. */
  radius: number;
}

let nextId = 1;

/** Base for everything that lives in the world and moves. Position is the top-left of the hitbox (px). */
export abstract class Entity implements Body {
  id = nextId++;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  onGround = false;
  facing: 1 | -1 = 1;
  age = 0;
  /** Marked for removal at the end of the tick. */
  removed = false;
  abstract readonly kind: EntityKind;

  constructor(
    public w: number,
    public h: number,
  ) {}

  get cx(): number {
    return this.x + this.w / 2;
  }

  get cy(): number {
    return this.y + this.h / 2;
  }

  get bottom(): number {
    return this.y + this.h;
  }

  rect(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  setCenter(x: number, y: number): void {
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
  }

  abstract update(ctx: GameContext): void;
  abstract render(g: CanvasRenderingContext2D, ctx: GameContext): void;

  light(): LightSource | null {
    return null;
  }
}
