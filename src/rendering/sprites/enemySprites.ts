import type { Enemy } from '../../entities/enemies/Enemy';
import { shade } from '../../utils/color';

/**
 * Procedural pixel-art enemy renderer. Each sprite kind draws in local
 * coordinates: origin at the bottom-centre of the hitbox, +x = facing direction.
 */
type Draw = (g: CanvasRenderingContext2D, e: Enemy, c: string[], t: number) => void;

const R = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) => {
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function eye(g: CanvasRenderingContext2D, x: number, y: number, col = '#ffffff', pupil = '#1a1420'): void {
  R(g, x, y, 3, 3, col);
  R(g, x + 1, y + 1, 2, 2, pupil);
}

function humanoid(g: CanvasRenderingContext2D, e: Enemy, t: number, o: { skin: string; body: string; legs: string; head?: string; armsForward?: boolean; hood?: string; hunch?: number }): void {
  const H = e.h;
  const walk = Math.abs(e.vx) > 0.2 && e.onGround ? Math.sin(t * 0.25) : 0;
  const hunch = o.hunch ?? 0;
  // Legs
  R(g, -5 + walk * 2, -14, 4, 14, o.legs);
  R(g, 1 - walk * 2, -14, 4, 14, shade(o.legs, 0.8));
  // Torso
  R(g, -6 + hunch, -H + 12, 12, H - 25, o.body);
  R(g, -6 + hunch, -H + 12, 12, 2, shade(o.body, 1.2));
  // Head
  R(g, -5 + hunch * 1.5, -H + 1, 10, 11, o.head ?? o.skin);
  if (o.hood) R(g, -6 + hunch * 1.5, -H, 12, 6, o.hood);
  eye(g, 1 + hunch * 1.5, -H + 5, '#ffe070', '#ff3030');
  // Arms
  if (o.armsForward) {
    R(g, hunch, -H + 14, 12, 4, o.skin);
  } else {
    R(g, -8 + hunch, -H + 13 - walk, 3, 12, shade(o.body, 0.85));
    R(g, 5 + hunch, -H + 13 + walk, 3, 12, o.skin);
  }
}

const SPRITES: Record<string, Draw> = {
  blob: (g, e, c, t) => {
    const squash = e.onGround ? 1 + Math.sin(t * 0.15) * 0.06 : e.vy < 0 ? 0.8 : 1.1;
    const w = e.w * (2 - squash) * 0.5;
    const h = e.h * squash;
    g.fillStyle = c[1];
    g.beginPath();
    g.ellipse(0, -h / 2, w + 1, h / 2 + 1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c[0];
    g.beginPath();
    g.ellipse(0, -h / 2 - 1, w, h / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.6;
    R(g, -w * 0.5, -h + 3, 4, 3, '#ffffff');
    g.globalAlpha = 1;
    eye(g, 1, -h * 0.65);
    eye(g, 6, -h * 0.65);
  },
  beetle: (g, e, c, t) => {
    const leg = Math.sin(t * 0.4) * 2;
    for (let i = 0; i < 3; i++) R(g, -8 + i * 6 + (i % 2 ? leg : -leg), -4, 2, 4, c[2]);
    g.fillStyle = c[0];
    g.beginPath();
    g.ellipse(-2, -8, 12, 8, 0, Math.PI, 0);
    g.fill();
    R(g, -14, -8, 24, 4, c[0]);
    R(g, -6, -15, 1, 11, c[2]);
    R(g, 8, -9, 6, 6, c[2]);
    R(g, 13, -13, 2, 5, c[1]);
    eye(g, 10, -8, '#ffe070');
    R(g, -10, -13, 6, 2, c[1]);
  },
  husk: (g, e, c, t) => humanoid(g, e, t, { skin: c[0], body: c[1], legs: c[2], armsForward: true, hunch: 2 }),
  shambler: (g, e, c, t) => {
    humanoid(g, e, t, { skin: c[0], body: shade(c[0], 0.8), legs: c[2], armsForward: true, hunch: 3 });
    R(g, -6, -e.h + 10, 4, 3, c[1]);
    R(g, 2, -e.h + 18, 3, 3, c[1]);
    R(g, -4, -e.h, 6, 2, c[1]);
  },
  stalker: (g, e, c, t) => {
    humanoid(g, e, t, { skin: c[0], body: c[1], legs: c[0], hood: c[0], armsForward: true, hunch: 1 });
    R(g, 1, -e.h + 4, 3, 2, c[2]);
    R(g, -3, -e.h + 4, 3, 2, c[2]);
  },
  scrapjack: (g, e, c, t) => {
    humanoid(g, e, t, { skin: '#7a9a5a', body: c[1], legs: shade(c[1], 0.7), head: '#7a9a5a' });
    R(g, -6, -e.h - 1, 12, 5, c[0]);
    R(g, -7, -e.h + 12, 14, 6, c[0]);
    R(g, 7, -e.h + 12, 2, 16, c[2]);
  },
  brute: (g, e, c, t) => {
    const walk = Math.abs(e.vx) > 0.2 ? Math.sin(t * 0.2) * 3 : 0;
    R(g, -11 + walk, -16, 8, 16, shade(c[1], 0.7));
    R(g, 3 - walk, -16, 8, 16, shade(c[1], 0.6));
    R(g, -14, -e.h + 12, 28, e.h - 28, c[1]);
    R(g, -15, -e.h + 12, 30, 8, c[0]);
    R(g, -7, -e.h, 14, 13, '#6a8a4a');
    R(g, -8, -e.h - 2, 16, 6, c[0]);
    eye(g, 2, -e.h + 5, '#ffe070', '#ff2020');
    R(g, 12, -e.h + 14, 8, 18, '#6a8a4a');
    R(g, 14, -e.h + 30, 10, 10, c[0]);
  },
  skeleton: (g, e, c, t) => {
    const walk = Math.abs(e.vx) > 0.2 ? Math.sin(t * 0.25) * 2 : 0;
    R(g, -4 + walk, -14, 2, 14, c[0]);
    R(g, 2 - walk, -14, 2, 14, c[0]);
    R(g, -5, -17, 10, 3, c[1]);
    for (let i = 0; i < 4; i++) R(g, -5, -30 + i * 3, 10, 2, c[0]);
    R(g, -1, -30, 2, 14, c[1]);
    R(g, -5, -41, 10, 10, c[0]);
    R(g, 0, -37, 3, 3, '#1a1420');
    R(g, -3, -37, 2, 3, '#1a1420');
    R(g, -2, -33, 6, 1, '#1a1420');
    // Bow
    g.strokeStyle = c[2];
    g.lineWidth = 2;
    g.beginPath();
    g.arc(6, -24, 9, -1.2, 1.2);
    g.stroke();
    R(g, 3, -27, 6, 2, c[0]);
  },
  caster: (g, e, c, t) => {
    const casting = e.state === 'cast';
    g.fillStyle = c[0];
    g.beginPath();
    g.moveTo(-9, 0);
    g.lineTo(9, 0);
    g.lineTo(5, -e.h + 12);
    g.lineTo(-5, -e.h + 12);
    g.fill();
    R(g, -6, -e.h + 3, 12, 11, c[0]);
    R(g, -4, -e.h + 6, 8, 7, '#120a1a');
    eye(g, 0, -e.h + 8, c[1], c[1]);
    R(g, -2, -e.h + 16, 4, 20, shade(c[0], 1.2));
    const hy = casting ? -e.h + 10 : -e.h + 22;
    R(g, 6, hy, 4, 4, c[2]);
    if (casting) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = c[1];
      g.globalAlpha = 0.5 + Math.sin(t * 0.5) * 0.3;
      g.beginPath();
      g.arc(10, hy, 6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  },
  imp: (g, e, c, t) => {
    const flap = Math.sin(t * 0.35) * 5;
    g.fillStyle = c[2];
    g.beginPath();
    g.moveTo(-3, -18);
    g.lineTo(-14, -26 + flap);
    g.lineTo(-10, -12);
    g.fill();
    R(g, -5, -20, 10, 14, c[0]);
    R(g, -4, -28, 9, 9, c[0]);
    R(g, -5, -31, 2, 4, c[2]);
    R(g, 4, -31, 2, 4, c[2]);
    eye(g, 1, -25, c[1], '#ffffff');
    R(g, -3, -6, 2, 6, c[2]);
    R(g, 2, -6, 2, 6, c[2]);
    R(g, -8, -10, 3, 8, c[2]);
    R(g, -10, -3, 3, 3, c[1]);
  },
  knight: (g, e, c, t) => {
    humanoid(g, e, t, { skin: c[0], body: c[0], legs: c[2], head: c[0] });
    R(g, -6, -e.h + 5, 12, 3, c[2]);
    R(g, 1, -e.h + 5, 4, 2, c[1]);
    R(g, -8, -e.h + 12, 16, 4, shade(c[0], 1.2));
    const swing = e.state === 'charge' ? -8 : 0;
    R(g, 8, -e.h + 6 + swing, 3, 24, '#b0b0b8');
    R(g, 6, -e.h + 26 + swing, 7, 2, c[1]);
  },
  bat: (g, e, c, t) => {
    const flap = Math.sin(t * 0.5) * 6;
    g.fillStyle = c[0];
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(-11, -9 - flap);
    g.lineTo(-8, -3);
    g.lineTo(-4, -5);
    g.fill();
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(11, -9 - flap);
    g.lineTo(8, -3);
    g.lineTo(4, -5);
    g.fill();
    R(g, -4, -11, 8, 8, c[1]);
    R(g, -3, -13, 2, 2, c[1]);
    R(g, 2, -13, 2, 2, c[1]);
    R(g, 0, -9, 2, 2, c[2]);
    R(g, -3, -9, 2, 2, c[2]);
  },
  lantern: (g, e, c, t) => {
    const bob = Math.sin(t * 0.1) * 2;
    for (let i = 0; i < 4; i++) {
      g.globalAlpha = 0.5 - i * 0.1;
      R(g, -3 + Math.sin(t * 0.2 + i) * 2, -6 + i * 2 + bob, 6 - i, 4, c[0]);
    }
    g.globalAlpha = 1;
    R(g, -8, -24 + bob, 16, 16, c[0]);
    R(g, -6, -22 + bob, 12, 12, e.state === 'windup' ? '#ffffff' : c[1]);
    R(g, -2, -19 + bob, 4, 6, c[2]);
    R(g, -4, -28 + bob, 8, 4, shade(c[0], 1.3));
    eye(g, -4, -19 + bob, '#1a1420', c[2]);
    eye(g, 2, -19 + bob, '#1a1420', c[2]);
  },
  scorpion: (g, e, c, t) => {
    if (e.state === 'buried') {
      R(g, -8, -3, 16, 3, '#c1a660');
      eye(g, -3, -5, '#1a1420', c[2]);
      eye(g, 2, -5, '#1a1420', c[2]);
      return;
    }
    const leg = Math.sin(t * 0.5) * 2;
    for (let i = 0; i < 4; i++) R(g, -10 + i * 5, -4 + (i % 2 ? leg : -leg) * 0.5, 2, 4, c[1]);
    R(g, -12, -10, 22, 7, c[0]);
    R(g, -12, -10, 22, 2, c[2]);
    R(g, 10, -9, 5, 4, c[1]);
    R(g, 14, -12, 3, 3, c[1]);
    // Tail
    for (let i = 0; i < 5; i++) R(g, -13 - (i < 3 ? i * 2 : 4), -12 - i * 3, 4, 4, i % 2 ? c[1] : c[0]);
    R(g, -14, -28, 3, 4, '#ff4a4a');
    eye(g, 7, -10, '#1a1420', '#ff4a4a');
  },
  wolf: (g, e, c, t) => {
    const run = Math.abs(e.vx) > 0.3 ? Math.sin(t * 0.45) * 3 : 0;
    R(g, -12 + run, -8, 3, 8, c[1]);
    R(g, -8 - run, -8, 3, 8, c[2]);
    R(g, 6 + run, -8, 3, 8, c[1]);
    R(g, 9 - run, -8, 3, 8, c[2]);
    R(g, -13, -16, 26, 9, c[0]);
    R(g, -13, -16, 26, 2, '#ffffff');
    R(g, 9, -21, 9, 8, c[0]);
    R(g, 16, -17, 4, 4, c[1]);
    R(g, 10, -24, 3, 4, c[0]);
    eye(g, 13, -19, '#8fe0ff', '#1a1420');
    R(g, -17, -17 - run * 0.5, 5, 3, c[0]);
  },
  spider: (g, e, c, t) => {
    const leg = Math.sin(t * 0.5) * 2;
    for (let i = 0; i < 4; i++) {
      const lx = -8 + i * 5;
      R(g, lx, -12 + (i % 2 ? leg : -leg), 2, 12, c[1]);
      R(g, lx - 3, -14 + (i % 2 ? leg : -leg), 4, 2, c[1]);
    }
    g.fillStyle = c[0];
    g.beginPath();
    g.ellipse(-5, -11, 9, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(7, -10, 5, 5, 0, 0, Math.PI * 2);
    g.fill();
    R(g, 6, -12, 2, 2, c[2]);
    R(g, 9, -12, 2, 2, c[2]);
    R(g, 8, -9, 2, 2, c[2]);
    R(g, -8, -15, 5, 2, shade(c[0], 1.4));
  },
  tortoise: (g, e, c, t) => {
    const hidden = e.state === 'hide' || e.state === 'roll';
    g.save();
    if (e.state === 'roll') {
      g.translate(0, -10);
      g.rotate(t * 0.3 * e.facing);
      g.translate(0, 10);
    }
    if (!hidden) {
      R(g, -12, -5, 5, 5, c[2]);
      R(g, 7, -5, 5, 5, c[2]);
      R(g, 12, -12, 7, 6, c[2]);
      eye(g, 15, -11, '#1a1420', '#ffe070');
    }
    g.fillStyle = c[1];
    g.beginPath();
    g.ellipse(0, -8, 15, 12, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = c[0];
    g.beginPath();
    g.ellipse(0, -9, 13, 10, 0, Math.PI, 0);
    g.fill();
    for (let i = -1; i <= 1; i++) R(g, i * 7 - 2, -15 + Math.abs(i) * 3, 5, 4, shade(c[0], 1.2));
    R(g, -15, -8, 30, 3, c[1]);
    g.restore();
  },
  worm: (g, e, c) => {
    const seg = e.mem.seg ?? 0;
    g.save();
    g.translate(0, -e.h / 2);
    g.rotate((e.mem.rot ?? 0) * e.facing);
    const s = e.w / 2;
    if (seg === 0) {
      R(g, -s, -s, s * 2, s * 2, c[0]);
      R(g, -s, -s, s * 2, 3, c[2]);
      R(g, s - 2, -s + 1, 5, 3, c[1]);
      R(g, s - 2, s - 4, 5, 3, c[1]);
      eye(g, s - 6, -3, '#1a1420', '#ff4a4a');
    } else {
      R(g, -s, -s + 1, s * 2, s * 2 - 2, seg === 2 ? c[1] : c[0]);
      R(g, -s, -s + 1, s * 2, 2, c[2]);
      R(g, -1, -s + 1, 2, s * 2 - 2, c[1]);
      if (seg === 2) R(g, -s - 4, -2, 4, 4, c[1]);
    }
    g.restore();
  },
  mote: (g, e, c, t) => {
    const bob = Math.sin(t * 0.08) * 2;
    g.fillStyle = c[1];
    g.beginPath();
    g.moveTo(0, -e.h - 2 + bob);
    g.lineTo(e.w / 2 + 1, -e.h / 2 + bob);
    g.lineTo(0, 2 + bob);
    g.lineTo(-e.w / 2 - 1, -e.h / 2 + bob);
    g.fill();
    g.fillStyle = c[0];
    g.beginPath();
    g.moveTo(0, -e.h + bob);
    g.lineTo(e.w / 2 - 1, -e.h / 2 + bob);
    g.lineTo(0, bob);
    g.lineTo(-e.w / 2 + 1, -e.h / 2 + bob);
    g.fill();
    R(g, -2, -e.h / 2 - 4 + bob, 3, 6, c[2]);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.06 + (i * Math.PI * 2) / 3;
      R(g, Math.cos(a) * 14 - 1.5, -e.h / 2 + Math.sin(a) * 8 + bob, 3, 3, c[0]);
    }
    if (e.state === 'charge') {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5;
      g.fillStyle = c[2];
      g.beginPath();
      g.arc(0, -e.h / 2 + bob, 12 + Math.sin(t) * 2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  },
  mimic: (g, e, c, t) => {
    const awake = e.state === 'awake';
    const open = awake ? 4 + Math.abs(Math.sin(t * 0.3)) * 6 : 0;
    R(g, -15, -16, 30, 16, c[0]);
    R(g, -15, -16, 30, 2, shade(c[0], 1.2));
    R(g, -11, -16, 3, 16, c[1]);
    R(g, 8, -16, 3, 16, c[1]);
    if (awake) {
      R(g, -14, -16 - open, 28, open, '#5a0a1a');
      for (let i = 0; i < 6; i++) R(g, -13 + i * 5, -16 - open, 3, 3, '#ffffff');
      R(g, -2, -18 - open * 0.5, 10, 3, c[2]);
    }
    R(g, -15, -30 - open, 30, 14, c[0]);
    R(g, -15, -30 - open, 30, 2, shade(c[0], 1.3));
    R(g, -11, -30 - open, 3, 14, c[1]);
    R(g, 8, -30 - open, 3, 14, c[1]);
    R(g, -3, -20 - open, 6, 6, c[1]);
    if (awake) {
      eye(g, -8, -27 - open, '#ffe070', '#ff2020');
      eye(g, 4, -27 - open, '#ffe070', '#ff2020');
    }
  },
  mushroom: (g, e, c, t) => {
    const walk = Math.abs(e.vx) > 0.2 ? Math.sin(t * 0.3) * 2 : 0;
    R(g, -4 + walk, -5, 3, 5, c[1]);
    R(g, 1 - walk, -5, 3, 5, c[1]);
    R(g, -5, -15, 10, 11, c[1]);
    eye(g, 0, -12, '#1a1420', '#1a1420');
    g.fillStyle = c[0];
    g.beginPath();
    g.ellipse(0, -16, 12, 9, 0, Math.PI, 0);
    g.fill();
    R(g, -12, -16, 24, 2, shade(c[0], 0.7));
    R(g, -6, -22, 3, 3, c[2]);
    R(g, 4, -20, 2, 2, c[2]);
  },
  shardling: (g, e, c, t) => {
    const pulse = Math.sin(t * 0.2) * 2;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + (i / 5) * Math.PI;
      g.fillStyle = i % 2 ? c[0] : c[1];
      g.beginPath();
      g.moveTo(-4, -10);
      g.lineTo(Math.cos(a) * (16 + pulse), -10 + Math.sin(a) * (16 + pulse));
      g.lineTo(4, -10);
      g.fill();
    }
    R(g, -9, -18, 18, 14, c[1]);
    R(g, -7, -16, 14, 10, c[0]);
    eye(g, 3, -14, c[2], '#ff2aff');
    const run = Math.sin(t * 0.4) * 2;
    R(g, -8 + run, -5, 3, 5, c[1]);
    R(g, 5 - run, -5, 3, 5, c[1]);
  },
  wraith: (g, e, c, t) => {
    g.globalAlpha = 0.75 + Math.sin(t * 0.1) * 0.15;
    for (let i = 0; i < 5; i++) R(g, -10 + i * 4, -12 + Math.sin(t * 0.2 + i) * 3, 4, 12, c[1]);
    R(g, -10, -e.h + 6, 20, e.h - 16, c[0]);
    R(g, -8, -e.h, 16, 12, c[0]);
    R(g, -6, -e.h + 4, 12, 7, c[1]);
    R(g, -4, -e.h + 6, 3, 2, c[2]);
    R(g, 2, -e.h + 6, 3, 2, c[2]);
    R(g, 8, -e.h + 12, 8, 3, c[0]);
    R(g, -16, -e.h + 12, 8, 3, c[0]);
    g.globalAlpha = 1;
  },
};

export function drawEnemy(g: CanvasRenderingContext2D, e: Enemy): void {
  const draw = SPRITES[e.def.sprite.kind];
  g.save();
  g.translate(Math.round(e.cx), Math.round(e.bottom));
  if (e.facing < 0) g.scale(-1, 1);
  if (e.hitFlash > 0 && e.hitFlash % 4 < 2) g.filter = 'brightness(2.2)';
  try {
    if (draw) draw(g, e, e.def.sprite.colors, e.frameTime);
    else R(g, -e.w / 2, -e.h, e.w, e.h, '#ff00ff');
  } finally {
    g.restore();
  }
}
