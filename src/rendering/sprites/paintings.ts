import { Pix, type Canvas2D } from './pixel';
import { ObjectSprites } from './objectSprites';
import { PAINT_PALETTE, ART_SCALE, FRAME_PX } from '../../world/paintings';
import type { PaintingData } from '../../world/WorldState';

/**
 * Sprites for painted canvases: the blank frame with the player's art laid
 * over it at 2×2 screen pixels per art pixel. Cached per canvas origin and
 * rebuilt when the art changes.
 */
const cache = new Map<string, { px: string; canvas: Canvas2D }>();

export function paintingSprite(key: string, p: PaintingData | undefined): Canvas2D | null {
  const frame = ObjectSprites.get(key, 0);
  if (!p || !frame) return frame;
  const ck = `${p.x},${p.y}`;
  const hit = cache.get(ck);
  if (hit && hit.px === p.px && hit.canvas.width === frame.width) return hit.canvas;
  const out = new Pix(frame.width, frame.height);
  out.g.drawImage(frame, 0, 0);
  drawArt(out, p, FRAME_PX, FRAME_PX, ART_SCALE);
  cache.set(ck, { px: p.px, canvas: out.canvas });
  return out.canvas;
}

/** Draw painting pixels at `scale` screen pixels each, skipping bare canvas (index 0). */
export function drawArt(out: Pix, p: PaintingData, ox: number, oy: number, scale: number): void {
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const idx = parseInt(p.px[y * p.w + x], 16);
      if (!idx) continue;
      out.g.fillStyle = PAINT_PALETTE[idx];
      out.g.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}
