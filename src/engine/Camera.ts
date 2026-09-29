import { clamp, lerp } from '../utils/math';

/** Smooth-follow camera with bounds, zoom and trauma-based screen shake. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 2;
  targetZoom = 2;
  /** Viewport size in CSS pixels. */
  viewW = 1280;
  viewH = 720;
  private trauma = 0;
  shakeX = 0;
  shakeY = 0;
  shakeEnabled = true;
  worldW = 0;
  worldH = 0;
  private time = 0;

  setBounds(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
  }

  get halfW(): number {
    return this.viewW / this.zoom / 2;
  }

  get halfH(): number {
    return this.viewH / this.zoom / 2;
  }

  /** Visible world rect (without shake). */
  get left(): number {
    return this.x - this.halfW;
  }

  get top(): number {
    return this.y - this.halfH;
  }

  get right(): number {
    return this.x + this.halfW;
  }

  get bottom(): number {
    return this.y + this.halfH;
  }

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clampToWorld();
  }

  /** Follow a target with exponential smoothing; `lead` offsets toward the cursor. */
  follow(tx: number, ty: number, leadX = 0, leadY = 0): void {
    this.time++;
    this.zoom = lerp(this.zoom, this.targetZoom, 0.15);
    const gx = tx + leadX;
    const gy = ty + leadY;
    this.x = lerp(this.x, gx, 0.14);
    this.y = lerp(this.y, gy, 0.14);
    this.clampToWorld();
    // Shake decays each tick.
    if (this.trauma > 0 && this.shakeEnabled) {
      const s = this.trauma * this.trauma * 14;
      this.shakeX = Math.sin(this.time * 1.7) * s * (Math.random() * 0.5 + 0.5);
      this.shakeY = Math.cos(this.time * 2.3) * s * (Math.random() * 0.5 + 0.5);
      this.trauma = Math.max(0, this.trauma - 0.025);
    } else {
      this.shakeX = this.shakeY = 0;
      this.trauma = Math.max(0, this.trauma - 0.025);
    }
  }

  clampToWorld(): void {
    if (!this.worldW) return;
    this.x = this.worldW < this.halfW * 2 ? this.worldW / 2 : clamp(this.x, this.halfW, this.worldW - this.halfW);
    this.y = this.worldH < this.halfH * 2 ? this.worldH / 2 : clamp(this.y, this.halfH, this.worldH - this.halfH);
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.viewW / 2) / this.zoom + this.x, (sy - this.viewH / 2) / this.zoom + this.y];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.viewW / 2, (wy - this.y) * this.zoom + this.viewH / 2];
  }
}
