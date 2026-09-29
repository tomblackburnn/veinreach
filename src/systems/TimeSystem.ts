import { DAY_TICKS } from '../core/config';
import { clamp, lerp, smoothstep } from '../utils/math';
import { mix } from '../utils/color';

export type DayPhase = 'sunrise' | 'day' | 'sunset' | 'night';

/** In-game clock. time 0 = midnight. */
export class TimeSystem {
  time = DAY_TICKS * (7.5 / 24);
  day = 1;
  /** Time multiplier (debug). */
  speed = 1;

  update(): boolean {
    this.time += this.speed;
    if (this.time >= DAY_TICKS) {
      this.time -= DAY_TICKS;
      this.day++;
      return true;
    }
    return false;
  }

  get hour(): number {
    return (this.time / DAY_TICKS) * 24;
  }

  setHour(h: number): void {
    this.time = ((((h % 24) + 24) % 24) / 24) * DAY_TICKS;
  }

  get phase(): DayPhase {
    const h = this.hour;
    if (h >= 4.5 && h < 6.5) return 'sunrise';
    if (h >= 6.5 && h < 18) return 'day';
    if (h >= 18 && h < 19.5) return 'sunset';
    return 'night';
  }

  get isNight(): boolean {
    const h = this.hour;
    return h >= 19.5 || h < 4.5;
  }

  get isDay(): boolean {
    return !this.isNight;
  }

  /** Sunlight level 0..1 with smooth dawn/dusk. */
  get daylight(): number {
    const h = this.hour;
    if (h >= 6.5 && h < 18) return 1;
    if (h >= 4.5 && h < 6.5) return smoothstep((h - 4.5) / 2);
    if (h >= 18 && h < 19.5) return 1 - smoothstep((h - 18) / 1.5);
    return 0;
  }

  /** 0..7 */
  get moonPhase(): number {
    return this.day % 8;
  }

  clockString(): string {
    const h = this.hour;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    const ampm = hh < 12 ? 'AM' : 'PM';
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ampm}`;
  }

  /** Sky gradient colours [top, horizon]. */
  skyColors(): [string, string] {
    const dl = this.daylight;
    const ph = this.phase;
    const dayTop = '#4f8fd0';
    const dayBot = '#a9d4f0';
    const nightTop = '#070b1c';
    const nightBot = '#1c2244';
    let top = mix(nightTop, dayTop, dl);
    let bot = mix(nightBot, dayBot, dl);
    if (ph === 'sunrise' || ph === 'sunset') {
      const h = this.hour;
      const t = ph === 'sunrise' ? 1 - Math.abs(h - 5.5) : 1 - Math.abs(h - 18.75) / 0.75;
      const warm = clamp(t, 0, 1);
      bot = mix(bot, ph === 'sunrise' ? '#f0a070' : '#e8704a', warm * 0.8);
      top = mix(top, '#6a4a8a', warm * 0.35);
    }
    return [top, bot];
  }

  /** Angle of the sun/moon across the sky 0..1. */
  celestialProgress(): { sun: number; moon: number } {
    const h = this.hour;
    const sun = clamp((h - 4.5) / 15, 0, 1);
    const nh = h >= 19.5 ? h - 19.5 : h + 4.5;
    return { sun, moon: clamp(lerp(0, 1, nh / 9), 0, 1) };
  }
}
