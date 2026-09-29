import { TICK_MS } from './config';

/**
 * Fixed-timestep simulation with variable-rate rendering. Simulation runs at
 * 60 Hz regardless of display refresh; render receives an interpolation alpha.
 */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  fps = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  /** Milliseconds spent in the last update+render (profiling). */
  frameCost = 0;

  constructor(
    private update: () => void,
    private render: (alpha: number, dtMs: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(250, now - this.last);
    this.last = now;
    this.acc += dt;
    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= TICK_MS && steps < 5) {
      try {
        this.update();
      } catch (err) {
        console.error('[GameLoop] update failed', err);
      }
      this.acc -= TICK_MS;
      steps++;
    }
    if (steps >= 5) this.acc = 0; // Spiral-of-death guard.
    try {
      this.render(this.acc / TICK_MS, dt);
    } catch (err) {
      console.error('[GameLoop] render failed', err);
    }
    this.frameCost = performance.now() - t0;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}
