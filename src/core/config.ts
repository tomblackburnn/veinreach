/** Global engine constants. Gameplay tuning lives in /data; these are structural. */
export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PX = TILE_SIZE * CHUNK_SIZE;

/** Fixed simulation rate. Physics constants below are per tick. */
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

export const PHYSICS = {
  gravity: 0.42,
  maxFall: 11,
  liquidGravityScale: 0.5,
  liquidMaxFall: 4,
} as const;

export const PLAYER_TUNING = {
  width: 20,
  height: 42,
  accel: 0.28,
  airAccel: 0.18,
  friction: 0.32,
  maxSpeed: 3.2,
  jumpSpeed: 7.6,
  jumpHoldTicks: 14,
  jumpHoldGravityScale: 0.45,
  reach: 6, // tiles
  pickupRadius: 5.5 * 16,
  grabRadius: 1.3 * 16,
  baseLife: 100,
  baseMana: 40,
  maxLifeCap: 500,
  maxManaCap: 200,
  invulnTicks: 40,
  respawnTicks: 60 * 5,
  fallDamageTiles: 25,
} as const;

/** Day length in ticks (24 in-game hours). 20 real minutes per full day. */
export const DAY_TICKS = 60 * 60 * 20;

export const WORLD_SIZES = {
  small: { width: 1400, height: 450, label: 'Small' },
  medium: { width: 2200, height: 620, label: 'Medium' },
  large: { width: 3400, height: 820, label: 'Large' },
} as const;
export type WorldSizeKey = keyof typeof WORLD_SIZES;

export const AUTOSAVE_SECONDS = 45;
export const SAVE_VERSION = 1;
/** Bump whenever world generation output changes; worlds remember the version they were made with. */
export const GEN_VERSION = 2;
export const GAME_TITLE = 'Veinreach';
export const GAME_VERSION = '0.1.0';
