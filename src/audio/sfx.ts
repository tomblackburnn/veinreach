/**
 * Procedurally synthesised sound effects (no audio assets required). Each
 * effect is a list of layers: an oscillator or noise source with pitch
 * envelope, amplitude envelope and optional filter.
 */
export interface SfxLayer {
  wave: OscillatorType | 'noise';
  freq: number;
  freqEnd?: number;
  dur: number;
  attack?: number;
  vol: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  delay?: number;
}

export const SFX: Record<string, SfxLayer[]> = {
  soil: [{ wave: 'noise', freq: 0, dur: 0.09, vol: 0.5, filter: { type: 'lowpass', freq: 900 } }],
  stone: [
    { wave: 'noise', freq: 0, dur: 0.07, vol: 0.45, filter: { type: 'bandpass', freq: 1800, q: 1.2 } },
    { wave: 'square', freq: 180, freqEnd: 90, dur: 0.05, vol: 0.12 },
  ],
  wood: [
    { wave: 'triangle', freq: 220, freqEnd: 120, dur: 0.09, vol: 0.4 },
    { wave: 'noise', freq: 0, dur: 0.05, vol: 0.25, filter: { type: 'lowpass', freq: 1400 } },
  ],
  plant: [{ wave: 'noise', freq: 0, dur: 0.07, vol: 0.3, filter: { type: 'highpass', freq: 2500 } }],
  glass: [
    { wave: 'sine', freq: 1800, freqEnd: 1600, dur: 0.18, vol: 0.18 },
    { wave: 'noise', freq: 0, dur: 0.06, vol: 0.3, filter: { type: 'highpass', freq: 4000 } },
  ],
  metal: [
    { wave: 'square', freq: 520, freqEnd: 500, dur: 0.16, vol: 0.12 },
    { wave: 'noise', freq: 0, dur: 0.05, vol: 0.25, filter: { type: 'bandpass', freq: 3000 } },
  ],
  crystal: [
    { wave: 'sine', freq: 1320, dur: 0.3, vol: 0.18 },
    { wave: 'sine', freq: 1980, dur: 0.25, vol: 0.1, delay: 0.03 },
  ],
  cloth: [{ wave: 'noise', freq: 0, dur: 0.08, vol: 0.25, filter: { type: 'lowpass', freq: 600 } }],
  chime: [
    { wave: 'sine', freq: 1568, dur: 1.4, attack: 0.002, vol: 0.09 },
    { wave: 'sine', freq: 4330, dur: 0.5, attack: 0.002, vol: 0.025 },
    { wave: 'triangle', freq: 3136, dur: 0.8, attack: 0.002, vol: 0.02, delay: 0.005 },
  ],
  place: [{ wave: 'noise', freq: 0, dur: 0.06, vol: 0.35, filter: { type: 'lowpass', freq: 700 } }, { wave: 'sine', freq: 140, freqEnd: 80, dur: 0.06, vol: 0.3 }],
  break: [{ wave: 'noise', freq: 0, dur: 0.16, vol: 0.5, filter: { type: 'lowpass', freq: 1200 } }],
  swing: [{ wave: 'noise', freq: 0, dur: 0.12, attack: 0.03, vol: 0.28, filter: { type: 'bandpass', freq: 900, q: 0.7 } }],
  bow: [{ wave: 'triangle', freq: 300, freqEnd: 160, dur: 0.12, vol: 0.3 }, { wave: 'noise', freq: 0, dur: 0.05, vol: 0.15, filter: { type: 'highpass', freq: 2000 } }],
  gun: [{ wave: 'noise', freq: 0, dur: 0.2, vol: 0.6, filter: { type: 'lowpass', freq: 2200 } }, { wave: 'square', freq: 120, freqEnd: 40, dur: 0.12, vol: 0.3 }],
  magic: [{ wave: 'sine', freq: 600, freqEnd: 1400, dur: 0.18, vol: 0.18 }, { wave: 'triangle', freq: 900, freqEnd: 1800, dur: 0.15, vol: 0.1, delay: 0.02 }],
  summon: [{ wave: 'sine', freq: 400, freqEnd: 900, dur: 0.35, vol: 0.2 }, { wave: 'sine', freq: 600, freqEnd: 1300, dur: 0.3, vol: 0.12, delay: 0.05 }],
  hit: [{ wave: 'noise', freq: 0, dur: 0.07, vol: 0.4, filter: { type: 'bandpass', freq: 1200 } }, { wave: 'square', freq: 200, freqEnd: 100, dur: 0.06, vol: 0.15 }],
  enemyHurt: [{ wave: 'square', freq: 260, freqEnd: 140, dur: 0.08, vol: 0.18 }, { wave: 'noise', freq: 0, dur: 0.05, vol: 0.2, filter: { type: 'lowpass', freq: 1500 } }],
  enemyDie: [{ wave: 'sawtooth', freq: 300, freqEnd: 60, dur: 0.3, vol: 0.2, filter: { type: 'lowpass', freq: 1200 } }, { wave: 'noise', freq: 0, dur: 0.2, vol: 0.25, filter: { type: 'lowpass', freq: 800 } }],
  playerHurt: [{ wave: 'square', freq: 180, freqEnd: 90, dur: 0.15, vol: 0.25 }, { wave: 'noise', freq: 0, dur: 0.1, vol: 0.2, filter: { type: 'lowpass', freq: 900 } }],
  playerDie: [{ wave: 'sawtooth', freq: 220, freqEnd: 40, dur: 1.0, vol: 0.3, filter: { type: 'lowpass', freq: 900 } }],
  pickup: [{ wave: 'square', freq: 660, freqEnd: 990, dur: 0.06, vol: 0.12 }],
  coin: [{ wave: 'square', freq: 1320, dur: 0.05, vol: 0.1 }, { wave: 'square', freq: 1760, dur: 0.1, vol: 0.1, delay: 0.05 }],
  craft: [{ wave: 'triangle', freq: 440, dur: 0.06, vol: 0.2 }, { wave: 'triangle', freq: 660, dur: 0.08, vol: 0.2, delay: 0.06 }, { wave: 'noise', freq: 0, dur: 0.05, vol: 0.15, filter: { type: 'bandpass', freq: 2500 } }],
  jump: [{ wave: 'square', freq: 200, freqEnd: 340, dur: 0.08, vol: 0.06 }],
  land: [{ wave: 'noise', freq: 0, dur: 0.06, vol: 0.2, filter: { type: 'lowpass', freq: 500 } }],
  step: [{ wave: 'noise', freq: 0, dur: 0.035, vol: 0.08, filter: { type: 'lowpass', freq: 700 } }],
  splash: [{ wave: 'noise', freq: 0, dur: 0.3, attack: 0.02, vol: 0.35, filter: { type: 'bandpass', freq: 1500, q: 0.6 } }],
  explosion: [{ wave: 'noise', freq: 0, dur: 0.6, vol: 0.8, filter: { type: 'lowpass', freq: 900 } }, { wave: 'sine', freq: 90, freqEnd: 30, dur: 0.5, vol: 0.5 }],
  bossRoar: [{ wave: 'sawtooth', freq: 90, freqEnd: 50, dur: 1.4, attack: 0.1, vol: 0.4, filter: { type: 'lowpass', freq: 600 } }, { wave: 'noise', freq: 0, dur: 1.2, attack: 0.2, vol: 0.3, filter: { type: 'lowpass', freq: 400 } }],
  bossDie: [{ wave: 'sawtooth', freq: 200, freqEnd: 30, dur: 2.2, vol: 0.4, filter: { type: 'lowpass', freq: 1000 } }, { wave: 'noise', freq: 0, dur: 2, vol: 0.5, filter: { type: 'lowpass', freq: 600 } }],
  bossAttack: [{ wave: 'sawtooth', freq: 160, freqEnd: 80, dur: 0.3, vol: 0.2, filter: { type: 'lowpass', freq: 900 } }],
  laser: [{ wave: 'sawtooth', freq: 900, freqEnd: 600, dur: 0.5, vol: 0.12, filter: { type: 'lowpass', freq: 3000 } }, { wave: 'sine', freq: 1800, dur: 0.5, vol: 0.06 }],
  charge: [{ wave: 'sine', freq: 200, freqEnd: 800, dur: 0.6, attack: 0.3, vol: 0.15 }],
  menuClick: [{ wave: 'square', freq: 880, dur: 0.04, vol: 0.08 }],
  menuHover: [{ wave: 'square', freq: 1320, dur: 0.02, vol: 0.04 }],
  drink: [{ wave: 'sine', freq: 300, freqEnd: 500, dur: 0.1, vol: 0.2 }, { wave: 'sine', freq: 350, freqEnd: 600, dur: 0.1, vol: 0.2, delay: 0.12 }],
  powerup: [{ wave: 'square', freq: 523, dur: 0.1, vol: 0.12 }, { wave: 'square', freq: 659, dur: 0.1, vol: 0.12, delay: 0.1 }, { wave: 'square', freq: 784, dur: 0.2, vol: 0.12, delay: 0.2 }],
  door: [{ wave: 'triangle', freq: 180, freqEnd: 120, dur: 0.15, vol: 0.3 }],
  chest: [{ wave: 'triangle', freq: 240, freqEnd: 160, dur: 0.12, vol: 0.3 }, { wave: 'noise', freq: 0, dur: 0.08, vol: 0.15, filter: { type: 'lowpass', freq: 900 } }],
  teleport: [{ wave: 'sine', freq: 300, freqEnd: 1500, dur: 0.4, vol: 0.2 }, { wave: 'sine', freq: 1500, freqEnd: 300, dur: 0.4, vol: 0.15, delay: 0.1 }],
  thunder: [{ wave: 'noise', freq: 0, dur: 2.0, attack: 0.05, vol: 0.6, filter: { type: 'lowpass', freq: 300 } }],
  eventStart: [{ wave: 'sawtooth', freq: 110, dur: 0.6, vol: 0.2, filter: { type: 'lowpass', freq: 800 } }, { wave: 'sawtooth', freq: 147, dur: 0.6, vol: 0.2, delay: 0.3, filter: { type: 'lowpass', freq: 800 } }],
  unseal: [{ wave: 'sawtooth', freq: 55, freqEnd: 40, dur: 4, attack: 0.5, vol: 0.4, filter: { type: 'lowpass', freq: 500 } }, { wave: 'sine', freq: 880, freqEnd: 220, dur: 3, vol: 0.15, delay: 0.5 }],
};
