import { SFX } from './sfx';
import { MusicPlayer, TRACKS } from './music';
import { fx } from '../utils/random';

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
}

interface Manifest {
  sfx?: Record<string, string>;
  music?: Record<string, string>;
}

/**
 * Central audio service. Everything degrades gracefully: if Web Audio is
 * unavailable or blocked, every call becomes a no-op.
 *
 * Asset override: list files in /assets/audio/manifest.json
 * ({ "sfx": { "hit": "sfx/hit.ogg" }, "music": { "day": "music/day.ogg" } })
 * and they replace the procedural sounds of the same name.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noise!: AudioBuffer;
  private current: { id: string; player?: MusicPlayer; source?: AudioBufferSourceNode; gain?: GainNode } | null = null;
  private wantedTrack = '';
  private lastPlayed = new Map<string, number>();
  private samples = new Map<string, AudioBuffer>();
  private musicFiles = new Map<string, AudioBuffer>();
  private amb: { rain?: GainNode; wind?: GainNode; lava?: GainNode } = {};
  listenerX = 0;
  listenerY = 0;
  volumes: Volumes = { master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.6 };
  available = typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (!this.available) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.ambBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.setupAmbience();
      void this.loadManifest();
      if (this.wantedTrack) this.setMusic(this.wantedTrack, true);
    } catch (err) {
      console.warn('[Audio] unavailable', err);
      this.available = false;
      this.ctx = null;
    }
  }

  private async loadManifest(): Promise<void> {
    if (!this.ctx) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}assets/audio/manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      const m = (await res.json()) as Manifest;
      const load = async (url: string) => {
        const r = await fetch(`${import.meta.env.BASE_URL}assets/audio/${url}`);
        return this.ctx!.decodeAudioData(await r.arrayBuffer());
      };
      for (const [k, url] of Object.entries(m.sfx ?? {})) load(url).then((b) => this.samples.set(k, b)).catch((e) => console.warn('[Audio] sfx load failed', k, e));
      for (const [k, url] of Object.entries(m.music ?? {})) load(url).then((b) => this.musicFiles.set(k, b)).catch((e) => console.warn('[Audio] music load failed', k, e));
    } catch {
      /* no manifest: procedural audio only */
    }
  }

  setVolumes(v: Partial<Volumes>): void {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx * 0.7, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.volumes.ambience * 0.5, t, 0.05);
  }

  setListener(x: number, y: number): void {
    this.listenerX = x;
    this.listenerY = y;
  }

  /**
   * Play a sound effect. If a world position is given, volume falls off with
   * distance from the listener and the sound is panned left/right.
   */
  play(name: string, opts: { x?: number; y?: number; volume?: number; pitch?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < 0.03) return;
    this.lastPlayed.set(name, now);
    let vol = opts.volume ?? 1;
    let pan = 0;
    if (opts.x !== undefined && opts.y !== undefined) {
      const dx = opts.x - this.listenerX;
      const d = Math.hypot(dx, opts.y - this.listenerY);
      vol *= Math.max(0, 1 - d / 900);
      pan = Math.max(-1, Math.min(1, dx / 500));
      if (vol <= 0.01) return;
    }
    const pitch = opts.pitch ?? fx.range(0.94, 1.06);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.sfxBus);
    const sample = this.samples.get(name);
    if (sample) {
      const s = ctx.createBufferSource();
      s.buffer = sample;
      s.playbackRate.value = pitch;
      const g = ctx.createGain();
      g.gain.value = vol;
      s.connect(g).connect(panner);
      s.start();
      return;
    }
    const layers = SFX[name];
    if (!layers) return;
    for (const L of layers) {
      const t = now + (L.delay ?? 0);
      const g = ctx.createGain();
      const a = L.attack ?? 0.005;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(L.vol * vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0008, t + L.dur);
      let src: AudioScheduledSourceNode;
      if (L.wave === 'noise') {
        const n = ctx.createBufferSource();
        n.buffer = this.noise;
        n.playbackRate.value = pitch;
        src = n;
      } else {
        const o = ctx.createOscillator();
        o.type = L.wave;
        o.frequency.setValueAtTime(L.freq * pitch, t);
        if (L.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, L.freqEnd * pitch), t + L.dur);
        src = o;
      }
      let node: AudioNode = src;
      if (L.filter) {
        const f = ctx.createBiquadFilter();
        f.type = L.filter.type;
        f.frequency.value = L.filter.freq;
        if (L.filter.q) f.Q.value = L.filter.q;
        node.connect(f);
        node = f;
      }
      node.connect(g).connect(panner);
      if (src instanceof AudioBufferSourceNode) src.start(t, Math.random() * 1.5);
      else src.start(t);
      src.stop(t + L.dur + 0.05);
    }
  }

  /** Switch background music (crossfade). Unknown ids fall back to silence. */
  setMusic(id: string, force = false): void {
    this.wantedTrack = id;
    const ctx = this.ctx;
    if (!ctx) return;
    if (!force && this.current?.id === id) return;
    const prev = this.current;
    if (prev) {
      prev.player?.stop(1.5);
      if (prev.gain && prev.source) {
        prev.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        const s = prev.source;
        setTimeout(() => s.stop(), 2000);
      }
    }
    const file = this.musicFiles.get(id);
    if (file) {
      const s = ctx.createBufferSource();
      s.buffer = file;
      s.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
      s.connect(g).connect(this.musicBus);
      s.start();
      this.current = { id, source: s, gain: g };
      return;
    }
    const tr = TRACKS[id];
    if (!tr) {
      this.current = { id };
      return;
    }
    const player = new MusicPlayer(ctx, tr, id, this.musicBus, this.noise);
    player.start();
    this.current = { id, player };
  }

  private setupAmbience(): void {
    const ctx = this.ctx!;
    const mk = (type: BiquadFilterType, freq: number, rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0;
      s.connect(f).connect(g).connect(this.ambBus);
      s.start();
      return g;
    };
    this.amb.rain = mk('highpass', 2500);
    this.amb.wind = mk('lowpass', 400, 0.5);
    this.amb.lava = mk('lowpass', 180, 0.3);
  }

  setAmbience(levels: { rain?: number; wind?: number; lava?: number }): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const k of ['rain', 'wind', 'lava'] as const) {
      const g = this.amb[k];
      if (g && levels[k] !== undefined) g.gain.setTargetAtTime(Math.max(0, Math.min(1, levels[k]!)), t, 0.8);
    }
  }
}
