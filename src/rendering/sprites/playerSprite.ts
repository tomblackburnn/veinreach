import type { Appearance } from '../../entities/player/Appearance';
import type { ArmorStats } from '../../items/types';
import { shade } from '../../utils/color';
import { itemIcon } from './itemIcons';

export type PlayerAnim = 'idle' | 'walk' | 'jump' | 'fall' | 'climb' | 'dead';

export interface PlayerPose {
  appearance: Appearance;
  armor: { head?: ArmorStats; body?: ArmorStats; legs?: ArmorStats };
  anim: PlayerAnim;
  /** Animation clock in ticks. */
  t: number;
  facing: 1 | -1;
  /** Front-arm angle in radians (0 = pointing forward) or null for the default pose. */
  armAngle: number | null;
  held?: { id: string; style: 'swing' | 'hold' | 'aim' | 'thrust'; angle: number; scale?: number } | null;
  flash?: boolean;
  alpha?: number;
}

const R = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function drawHair(g: CanvasRenderingContext2D, style: number, c: string): void {
  const d = shade(c, 0.75);
  switch (style) {
    case 0: // crop
      R(g, -5, -41, 10, 3, c);
      R(g, -6, -40, 2, 5, c);
      break;
    case 1: // messy
      R(g, -6, -42, 12, 4, c);
      R(g, -7, -40, 3, 7, c);
      R(g, -3, -43, 3, 2, c);
      R(g, 2, -43, 2, 2, d);
      R(g, 3, -39, 3, 2, c);
      break;
    case 2: // long
      R(g, -6, -42, 12, 4, c);
      R(g, -7, -40, 4, 16, c);
      R(g, -6, -26, 3, 2, d);
      break;
    case 3: // ponytail
      R(g, -6, -42, 12, 4, c);
      R(g, -7, -40, 3, 6, c);
      R(g, -10, -38, 4, 10, c);
      R(g, -9, -29, 2, 3, d);
      break;
    case 4: // mohawk
      R(g, -2, -45, 5, 6, c);
      R(g, -6, -39, 2, 4, d);
      break;
    case 5: // bald
      R(g, -5, -40, 9, 1, shade(c, 0.6));
      break;
    case 6: // bob
      R(g, -6, -42, 12, 4, c);
      R(g, -7, -40, 4, 11, c);
      R(g, 4, -40, 2, 9, c);
      break;
    default: // spiky
      for (let i = 0; i < 5; i++) R(g, -6 + i * 3, -44 + (i % 2) * 2, 3, 5, i % 2 ? d : c);
      R(g, -7, -40, 3, 5, c);
  }
}

/**
 * Draw a player figure with feet at (0,0) in the current transform, facing right.
 * Caller handles flipping for facing and translation.
 */
function drawFigure(g: CanvasRenderingContext2D, p: PlayerPose): void {
  const a = p.appearance;
  const walking = p.anim === 'walk';
  const swing = walking ? Math.sin(p.t * 0.28) : 0;
  const air = p.anim === 'jump' || p.anim === 'fall';
  const legs = p.armor.legs;
  const body = p.armor.body;
  const head = p.armor.head;
  const pants = legs?.color ?? a.pantsColor;
  const pantsD = shade(pants, 0.8);
  const shoes = legs ? shade(legs.color, 0.7) : a.shoeColor;
  const shirt = body?.color ?? a.shirtColor;
  const sleeve = body ? shade(body.color, 0.85) : a.shirtColor;
  const bob = walking ? Math.abs(swing) * -1 : 0;

  // Back arm
  const backArm = air ? -0.9 : p.anim === 'climb' ? -2.2 + Math.sin(p.t * 0.3) * 0.4 : -swing * 0.6;
  g.save();
  g.translate(-1, -27 + bob);
  g.rotate(backArm);
  R(g, -1, 0, 3, 11, shade(sleeve, 0.7));
  R(g, -1, 9, 3, 3, shade(a.skinColor, 0.8));
  g.restore();

  // Legs
  const l1 = air ? -3 : swing * 3;
  const l2 = air ? 2 : -swing * 3;
  R(g, -4 + l1, -14, 4, 11, pantsD);
  R(g, -4 + l1, -3, 5, 3, shade(shoes, 0.85));
  R(g, 0 + l2, -14, 4, 11, pants);
  R(g, 0 + l2, -3, 5, 3, shoes);
  if (legs?.trim) {
    R(g, -4 + l1, -9, 4, 1, legs.trim);
    R(g, l2, -9, 4, 1, legs.trim);
  }

  // Torso
  R(g, -5, -28 + bob, 10, 15, shirt);
  R(g, -5, -28 + bob, 10, 2, shade(shirt, 1.2));
  R(g, -5, -15 + bob, 10, 2, body ? shade(body.color, 0.7) : '#4a3a2a');
  if (body?.trim) {
    R(g, -1, -26 + bob, 2, 10, body.trim);
    R(g, -6, -28 + bob, 3, 4, body.trim);
    R(g, 3, -28 + bob, 3, 4, body.trim);
  }

  // Head
  R(g, -5, -40 + bob, 10, 12, a.skinColor);
  R(g, 3, -36 + bob, 2, 2, '#ffffff');
  R(g, 4, -36 + bob, 1, 2, a.eyeColor);
  R(g, 2, -31 + bob, 3, 1, shade(a.skinColor, 0.75));
  if (head) {
    R(g, -6, -42 + bob, 12, 7, head.color);
    R(g, -6, -42 + bob, 12, 2, shade(head.color, 1.25));
    R(g, -6, -35 + bob, 3, 5, head.color);
    if (head.trim) R(g, -6, -36 + bob, 12, 1, head.trim);
  } else {
    g.save();
    g.translate(0, bob);
    drawHair(g, a.hairStyle, a.hairColor);
    g.restore();
  }

  // Held item (behind the front arm).
  if (p.held) drawHeld(g, p, bob);

  // Front arm
  const armA = p.armAngle ?? (air ? -1.1 : p.anim === 'climb' ? -2.6 + Math.sin(p.t * 0.3 + 1) * 0.4 : swing * 0.6);
  g.save();
  g.translate(1, -27 + bob);
  g.rotate(armA);
  R(g, -1, 0, 3, 11, sleeve);
  if (body?.trim) R(g, -1, 0, 3, 2, body.trim);
  R(g, -1, 9, 3, 3, a.skinColor);
  g.restore();
}

function drawHeld(g: CanvasRenderingContext2D, p: PlayerPose, bob: number): void {
  const h = p.held!;
  const icon = itemIcon(h.id);
  const scale = icon.width > 16 ? 16 / icon.width : 1;
  g.save();
  // Hand position follows the arm angle.
  const armA = p.armAngle ?? 0;
  const hx = 1 + Math.cos(armA + Math.PI / 2) * 10;
  const hy = -27 + bob + Math.sin(armA + Math.PI / 2) * 10;
  g.translate(hx, hy);
  if (h.style === 'swing') {
    // Icon drawn with grip at bottom-left; rotate so blade points along the angle.
    g.rotate(h.angle + Math.PI / 4);
    g.scale(h.scale ?? 1.25, h.scale ?? 1.25);
    g.drawImage(icon, -2, -icon.height * scale + 2, icon.width * scale, icon.height * scale);
  } else if (h.style === 'aim' || h.style === 'thrust') {
    g.rotate(h.angle);
    g.drawImage(icon, -4, -icon.height * scale * 0.6, icon.width * scale, icon.height * scale);
  } else {
    g.drawImage(icon, -4, -12, icon.width * scale * 0.8, icon.height * scale * 0.8);
  }
  g.restore();
}

/** Draw the player with feet at (x, y) in world/screen space. */
export function drawPlayer(g: CanvasRenderingContext2D, x: number, y: number, p: PlayerPose): void {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (p.facing < 0) g.scale(-1, 1);
  if (p.alpha !== undefined) g.globalAlpha = p.alpha;
  if (p.flash) g.filter = 'brightness(2.2)';
  if (p.anim === 'dead') {
    g.rotate(Math.PI / 2);
    g.translate(-4, 10);
  }
  drawFigure(g, p);
  g.restore();
}
