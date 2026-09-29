import type { PaintingData } from './WorldState';
import type { World } from './World';
import { TileRegistry } from './TileRegistry';

/** Art pixels per tile on a canvas (each art pixel is 2×2 screen pixels); one art pixel per edge is frame. */
export const ART_PER_TILE = 8;
export const ART_SCALE = 2;
export const FRAME_PX = 2;

/** The painting palette. Index 0 is bare canvas. */
export const PAINT_PALETTE = [
  '#efe4c8', '#1a1420', '#5a4a5e', '#9a8f9e', '#ffffff', '#b8434a', '#ff8a3a', '#f5cf3c',
  '#4fa33b', '#2a6a3a', '#45c8d8', '#3e5fb0', '#7a4fa8', '#e85d9a', '#8b5a2b', '#e8b48a',
];

export function isCanvasTile(id: number): boolean {
  const key = TileRegistry.get(id).key;
  return key === 'canvas_small' || key === 'canvas_wide';
}

/** Art resolution for a canvas tile. */
export function canvasArtSize(tileId: number): [number, number] {
  const [w, h] = TileRegistry.get(tileId).size ?? [1, 1];
  return [w * ART_PER_TILE - 2, h * ART_PER_TILE - 2];
}

export function blankArt(w: number, h: number): string {
  return '0'.repeat(w * h);
}

/** True if any pixel differs from bare canvas. */
export function isPainted(p: PaintingData | undefined): boolean {
  return !!p && /[1-9a-f]/.test(p.px);
}

/** Validate untrusted painting data (save files, network). Returns a clean copy or null. */
export function sanitizePainting(raw: unknown): PaintingData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const { x, y, w, h, px } = r;
  if (![x, y, w, h].every((v) => Number.isInteger(v))) return null;
  if ((w as number) < 1 || (h as number) < 1 || (w as number) > 64 || (h as number) > 64) return null;
  if (typeof px !== 'string' || px.length !== (w as number) * (h as number) || !/^[0-9a-f]*$/.test(px)) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number, px };
}

/** Does this painting match the canvas object actually placed in the world? */
export function paintingFits(world: World, p: PaintingData): boolean {
  const id = world.getFg(p.x, p.y);
  if (!isCanvasTile(id) || world.getFrame(p.x, p.y) !== 0) return false;
  const [w, h] = canvasArtSize(id);
  return p.w === w && p.h === h;
}

/** Apply a painting received from elsewhere (server/peer). Returns false if it was rejected. */
export function applyRemotePainting(world: World, raw: unknown): boolean {
  const p = sanitizePainting(raw);
  if (!p || !paintingFits(world, p)) return false;
  const key = world.chestKey(p.x, p.y);
  if (isPainted(p)) world.paintings.set(key, p);
  else world.paintings.delete(key);
  const [tw, th] = TileRegistry.get(world.getFg(p.x, p.y)).size ?? [1, 1];
  world.invalidateRender(p.x, p.y, tw, th);
  return true;
}
