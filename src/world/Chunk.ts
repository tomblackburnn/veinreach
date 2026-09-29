import { CHUNK_SIZE } from '../core/config';

const N = CHUNK_SIZE * CHUNK_SIZE;

/**
 * A CHUNK_SIZE² block of tile data. Arrays are row-major (index = ly * CHUNK_SIZE + lx).
 *
 * - fg:        foreground tile id
 * - wall:      background wall id
 * - liquid:    liquid amount 0..255
 * - liquidType 0 none / 1 water / 2 lava
 * - frame:     per-tile metadata. Multi-tile objects store (offsetX | offsetY << 4);
 *              trees store their species; torches/others may store variants.
 * - explored:  1 when the player has seen this tile (minimap)
 */
export class Chunk {
  readonly fg = new Uint16Array(N);
  readonly wall = new Uint16Array(N);
  readonly liquid = new Uint8Array(N);
  readonly liquidType = new Uint8Array(N);
  readonly frame = new Uint8Array(N);
  readonly explored = new Uint8Array(N);

  /** Tile data differs from the procedurally generated baseline — must be saved. */
  modified = false;
  /** Explored map changed since last save. */
  exploredDirty = false;
  /** Render cache must be rebuilt. */
  renderDirty = true;

  constructor(
    readonly cx: number,
    readonly cy: number,
  ) {}

  static index(lx: number, ly: number): number {
    return ly * CHUNK_SIZE + lx;
  }
}
