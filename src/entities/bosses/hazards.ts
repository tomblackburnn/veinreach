import type { GameContext } from '../../core/context';
import { pointSegDist, rectsOverlap } from '../../utils/math';

/**
 * Telegraphed arena hazards owned by a boss: a warning phase (visual only)
 * followed by an active phase that damages the player.
 */
export interface Hazard {
  kind: 'spike' | 'beam' | 'ring' | 'column' | 'burst';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  width?: number;
  warn: number;
  active: number;
  age: number;
  damage: number;
  color: string;
  /** Per-tick update hook (e.g. rotating beams). */
  step?: (h: Hazard) => void;
  /** Persist until removed by the boss. */
  permanent?: boolean;
  hit?: boolean;
}

export function updateHazards(ctx: GameContext, list: Hazard[]): Hazard[] {
  const p = ctx.player;
  for (const h of list) {
    h.age++;
    h.step?.(h);
    const live = h.age > h.warn;
    if (h.age === h.warn + 1) {
      if (h.kind === 'spike') {
        ctx.audio.play('stone', { x: h.x, y: h.y, pitch: 0.6 });
        ctx.particles.dust(h.x, h.y, h.color, 10);
      } else if (h.kind === 'beam') ctx.audio.play('laser', { x: h.x, y: h.y });
      else if (h.kind === 'burst') {
        ctx.audio.play('explosion', { x: h.x, y: h.y, volume: 0.7 });
        ctx.particles.emit(h.x, h.y, { count: 40, colors: [h.color, '#ffffff'], speed: [2, 6], glow: true, gravity: 0 });
        ctx.shake(0.2);
      }
    }
    if (!live || p.dead) continue;
    switch (h.kind) {
      case 'spike': {
        const t = Math.min(1, (h.age - h.warn) / 8);
        const height = (h.r ?? 80) * t;
        const rect = { x: h.x - 10, y: h.y - height, w: 20, h: height };
        if (rectsOverlap(rect, p.rect())) p.hurt(ctx, { damage: h.damage, knockback: 8, dirX: Math.sign(p.cx - h.x) || 1, immunity: 40 });
        break;
      }
      case 'beam': {
        const d = pointSegDist(p.cx, p.cy, h.x, h.y, h.x2!, h.y2!);
        if (d < (h.width ?? 16) / 2 + 10) p.hurt(ctx, { damage: h.damage, knockback: 5, dirX: Math.sign(p.cx - h.x) || 1, immunity: 30, buff: { buff: 'burning', seconds: 3, chance: 0.5 } });
        break;
      }
      case 'burst':
        if (h.age - h.warn < 4 && Math.hypot(p.cx - h.x, p.cy - h.y) < (h.r ?? 60)) p.hurt(ctx, { damage: h.damage, knockback: 9, dirX: Math.sign(p.cx - h.x) || 1, immunity: 40 });
        break;
      case 'ring': {
        const d = Math.hypot(p.cx - h.x, p.cy - h.y);
        if (d > (h.r ?? 600)) {
          p.hurt(ctx, { damage: h.damage, knockback: 0, dirX: 0, immunity: 30 });
          const a = Math.atan2(h.y - p.cy, h.x - p.cx);
          p.vx = Math.cos(a) * 9;
          p.vy = Math.sin(a) * 9;
        }
        break;
      }
      case 'column':
        break;
    }
  }
  return list.filter((h) => h.permanent || h.age <= h.warn + h.active);
}

export function renderHazards(g: CanvasRenderingContext2D, list: Hazard[], tick: number): void {
  for (const h of list) {
    const warning = h.age <= h.warn;
    const blink = Math.floor(tick / 4) % 2 === 0;
    g.save();
    switch (h.kind) {
      case 'spike': {
        if (warning) {
          g.globalAlpha = 0.35 + (blink ? 0.3 : 0);
          g.fillStyle = h.color;
          g.fillRect(h.x - 10, h.y - 4, 20, 4);
          g.globalAlpha = 0.15;
          g.fillRect(h.x - 10, h.y - (h.r ?? 80), 20, h.r ?? 80);
        } else {
          const t = Math.min(1, (h.age - h.warn) / 8);
          const fade = Math.min(1, (h.warn + h.active - h.age) / 10);
          const height = (h.r ?? 80) * t;
          g.globalAlpha = fade;
          g.fillStyle = '#3a2a1a';
          g.beginPath();
          g.moveTo(h.x - 10, h.y);
          g.lineTo(h.x, h.y - height);
          g.lineTo(h.x + 10, h.y);
          g.fill();
          g.fillStyle = h.color;
          g.beginPath();
          g.moveTo(h.x - 5, h.y);
          g.lineTo(h.x, h.y - height * 0.9);
          g.lineTo(h.x + 3, h.y);
          g.fill();
        }
        break;
      }
      case 'beam': {
        g.lineCap = 'round';
        if (warning) {
          g.globalAlpha = blink ? 0.7 : 0.35;
          g.strokeStyle = h.color;
          g.lineWidth = 2;
          g.setLineDash([8, 6]);
        } else {
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = h.color;
          g.lineWidth = (h.width ?? 16) + Math.sin(tick * 0.8) * 2;
          g.globalAlpha = 0.6;
          g.beginPath();
          g.moveTo(h.x, h.y);
          g.lineTo(h.x2!, h.y2!);
          g.stroke();
          g.strokeStyle = '#ffffff';
          g.lineWidth = (h.width ?? 16) * 0.35;
          g.globalAlpha = 0.9;
        }
        g.beginPath();
        g.moveTo(h.x, h.y);
        g.lineTo(h.x2!, h.y2!);
        g.stroke();
        break;
      }
      case 'burst':
        g.strokeStyle = h.color;
        g.lineWidth = 2;
        g.globalAlpha = warning ? (blink ? 0.8 : 0.4) : Math.max(0, 1 - (h.age - h.warn) / 15);
        g.beginPath();
        g.arc(h.x, h.y, warning ? (h.r ?? 60) * (h.age / h.warn) : h.r ?? 60, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'ring': {
        const r = h.r ?? 600;
        g.globalAlpha = warning ? 0.3 : 0.7;
        g.strokeStyle = h.color;
        g.lineWidth = 4;
        g.setLineDash([12, 10]);
        g.lineDashOffset = -tick;
        g.beginPath();
        g.arc(h.x, h.y, r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = h.color;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + tick * 0.01;
          g.fillRect(h.x + Math.cos(a) * r - 3, h.y + Math.sin(a) * r - 3, 6, 6);
        }
        break;
      }
      case 'column':
        g.globalAlpha = blink ? 0.3 : 0.15;
        g.fillStyle = h.color;
        g.fillRect(h.x - (h.width ?? 40) / 2, h.y - 2000, h.width ?? 40, 4000);
        break;
    }
    g.restore();
  }
}
