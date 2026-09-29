import { Rng, hashString } from '../utils/random';

/**
 * Generative music: each track is a small set of parameters from which chord
 * progressions, bass lines and melodies are derived. Scheduled with a
 * look-ahead timer on the AudioContext clock.
 */
export interface TrackDef {
  tempo: number;
  root: number; // MIDI note
  scale: number[];
  progression: number[]; // scale degrees
  pad: OscillatorType;
  lead: OscillatorType;
  leadDensity: number;
  bass: boolean;
  drums: 'none' | 'soft' | 'march' | 'battle';
  brightness: number; // filter cutoff multiplier
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

export const TRACKS: Record<string, TrackDef> = {
  title: { tempo: 76, root: 57, scale: DORIAN, progression: [0, 5, 3, 4], pad: 'triangle', lead: 'sine', leadDensity: 0.35, bass: true, drums: 'none', brightness: 1 },
  day: { tempo: 96, root: 60, scale: MAJOR, progression: [0, 4, 5, 3], pad: 'triangle', lead: 'square', leadDensity: 0.45, bass: true, drums: 'soft', brightness: 1.2 },
  night: { tempo: 70, root: 57, scale: MINOR, progression: [0, 5, 2, 6], pad: 'sine', lead: 'triangle', leadDensity: 0.25, bass: true, drums: 'none', brightness: 0.7 },
  underground: { tempo: 80, root: 50, scale: DORIAN, progression: [0, 3, 0, 6], pad: 'triangle', lead: 'triangle', leadDensity: 0.3, bass: true, drums: 'soft', brightness: 0.7 },
  dunes: { tempo: 92, root: 55, scale: PHRYGIAN, progression: [0, 1, 0, 6], pad: 'triangle', lead: 'square', leadDensity: 0.4, bass: true, drums: 'soft', brightness: 1 },
  taiga: { tempo: 72, root: 62, scale: LYDIAN, progression: [0, 1, 4, 0], pad: 'sine', lead: 'sine', leadDensity: 0.35, bass: false, drums: 'none', brightness: 1.3 },
  blight: { tempo: 78, root: 52, scale: HARMONIC, progression: [0, 5, 1, 4], pad: 'sawtooth', lead: 'triangle', leadDensity: 0.3, bass: true, drums: 'soft', brightness: 0.6 },
  sporeglow: { tempo: 84, root: 57, scale: PENTA, progression: [0, 2, 3, 1], pad: 'sine', lead: 'sine', leadDensity: 0.5, bass: false, drums: 'soft', brightness: 1.1 },
  glimmer: { tempo: 68, root: 64, scale: LYDIAN, progression: [0, 4, 1, 5], pad: 'sine', lead: 'sine', leadDensity: 0.55, bass: false, drums: 'none', brightness: 1.5 },
  emberdeep: { tempo: 104, root: 45, scale: PHRYGIAN, progression: [0, 1, 0, 5], pad: 'sawtooth', lead: 'square', leadDensity: 0.35, bass: true, drums: 'march', brightness: 0.8 },
  shardblight: { tempo: 88, root: 49, scale: HARMONIC, progression: [0, 6, 5, 1], pad: 'sawtooth', lead: 'sine', leadDensity: 0.4, bass: true, drums: 'soft', brightness: 0.9 },
  keep: { tempo: 66, root: 48, scale: MINOR, progression: [0, 6, 5, 4], pad: 'square', lead: 'triangle', leadDensity: 0.3, bass: true, drums: 'march', brightness: 0.55 },
  sky: { tempo: 86, root: 67, scale: MAJOR, progression: [0, 3, 4, 3], pad: 'sine', lead: 'triangle', leadDensity: 0.45, bass: false, drums: 'none', brightness: 1.5 },
  event: { tempo: 120, root: 50, scale: MINOR, progression: [0, 6, 5, 6], pad: 'sawtooth', lead: 'square', leadDensity: 0.5, bass: true, drums: 'battle', brightness: 1 },
  boss1: { tempo: 132, root: 45, scale: MINOR, progression: [0, 5, 6, 4], pad: 'sawtooth', lead: 'square', leadDensity: 0.6, bass: true, drums: 'battle', brightness: 1 },
  boss2: { tempo: 124, root: 47, scale: HARMONIC, progression: [0, 1, 5, 4], pad: 'sawtooth', lead: 'square', leadDensity: 0.6, bass: true, drums: 'battle', brightness: 1.1 },
  boss3: { tempo: 140, root: 50, scale: DORIAN, progression: [0, 3, 6, 4], pad: 'square', lead: 'sawtooth', leadDensity: 0.65, bass: true, drums: 'battle', brightness: 1.3 },
  boss4: { tempo: 146, root: 44, scale: PHRYGIAN, progression: [0, 1, 6, 1], pad: 'sawtooth', lead: 'square', leadDensity: 0.7, bass: true, drums: 'battle', brightness: 1 },
  boss5: { tempo: 150, root: 52, scale: HARMONIC, progression: [0, 5, 3, 4, 0, 6, 1, 4], pad: 'sawtooth', lead: 'square', leadDensity: 0.75, bass: true, drums: 'battle', brightness: 1.4 },
};

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class MusicPlayer {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private rng: Rng;
  private melodyNote = 0;
  readonly out: GainNode;
  private noiseBuf: AudioBuffer;

  constructor(
    private ctx: AudioContext,
    private track: TrackDef,
    trackId: string,
    dest: AudioNode,
    noise: AudioBuffer,
  ) {
    this.rng = new Rng(hashString(trackId));
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.noiseBuf = noise;
  }

  start(fadeIn = 1.5): void {
    this.nextTime = this.ctx.currentTime + 0.1;
    this.out.gain.setTargetAtTime(1, this.ctx.currentTime, fadeIn / 3);
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  stop(fadeOut = 1.5): void {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, fadeOut / 3);
    const t = this.timer;
    window.setTimeout(() => {
      if (t !== null) clearInterval(t);
      this.out.disconnect();
    }, fadeOut * 1000 + 200);
    this.timer = null;
  }

  private schedule(): void {
    const stepDur = 60 / this.track.tempo / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private note(freq: number, t: number, dur: number, wave: OscillatorType, vol: number, cutoff = 2000): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = wave;
    o.frequency.value = freq;
    f.type = 'lowpass';
    f.frequency.value = cutoff * this.track.brightness;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.3));
    g.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.3);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat', vol: number): void {
    if (kind === 'kick') {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = this.ctx.createGain();
    const d = kind === 'hat' ? 0.04 : 0.12;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random());
    s.stop(t + d + 0.05);
  }

  private playStep(step: number, t: number, sd: number): void {
    const tr = this.track;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const degree = tr.progression[bar % tr.progression.length];
    const sc = tr.scale;
    const deg = (d: number) => tr.root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
    if (inBar === 0) {
      for (const k of [0, 2, 4]) this.note(midiHz(deg(degree + k)), t, sd * 16, tr.pad, 0.045, 1200);
    }
    if (tr.bass && inBar % 4 === 0) this.note(midiHz(deg(degree) - 12), t, sd * 3, 'triangle', 0.12, 600);
    if (inBar % 2 === 0 && this.rng.next() < tr.leadDensity) {
      this.melodyNote += this.rng.int(-2, 2);
      this.melodyNote = Math.max(-2, Math.min(9, this.melodyNote));
      if (inBar === 0) this.melodyNote = degree + 7;
      const len = this.rng.chance(0.3) ? 4 : 2;
      this.note(midiHz(deg(this.melodyNote) + 12), t, sd * len, tr.lead, 0.035, 2500);
    }
    switch (tr.drums) {
      case 'soft':
        if (inBar % 8 === 0) this.drum(t, 'kick', 0.25);
        if (inBar % 4 === 2) this.drum(t, 'hat', 0.05);
        break;
      case 'march':
        if (inBar % 4 === 0) this.drum(t, 'kick', 0.35);
        if (inBar % 8 === 4) this.drum(t, 'snare', 0.15);
        break;
      case 'battle':
        if (inBar % 4 === 0 || inBar === 10) this.drum(t, 'kick', 0.45);
        if (inBar % 8 === 4) this.drum(t, 'snare', 0.22);
        if (inBar % 2 === 0) this.drum(t, 'hat', 0.07);
        break;
    }
  }
}
