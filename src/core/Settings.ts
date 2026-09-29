import { DEFAULT_BINDINGS, type Action } from '../engine/InputManager';

export interface SettingsData {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  uiScale: number;
  zoom: number;
  screenShake: boolean;
  particles: number;
  showFps: boolean;
  smoothLighting: boolean;
  developerMode: boolean;
  autosave: boolean;
  bindings: Record<Action, string[]>;
  multiplayerUrl: string;
}

export function defaultSettings(): SettingsData {
  return {
    masterVolume: 0.8,
    musicVolume: 0.45,
    sfxVolume: 0.8,
    ambienceVolume: 0.6,
    uiScale: 1,
    zoom: 2,
    screenShake: true,
    particles: 1,
    showFps: false,
    smoothLighting: true,
    developerMode: false,
    autosave: true,
    bindings: structuredClone(DEFAULT_BINDINGS),
    multiplayerUrl: 'ws://localhost:7777',
  };
}

/** Merge persisted settings over defaults, ignoring junk values. */
export function sanitizeSettings(raw: unknown): SettingsData {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const num = (k: keyof SettingsData, min: number, max: number) => {
    const v = r[k];
    if (typeof v === 'number' && isFinite(v)) (d as unknown as Record<string, unknown>)[k] = Math.max(min, Math.min(max, v));
  };
  const bool = (k: keyof SettingsData) => {
    if (typeof r[k] === 'boolean') (d as unknown as Record<string, unknown>)[k] = r[k];
  };
  num('masterVolume', 0, 1);
  num('musicVolume', 0, 1);
  num('sfxVolume', 0, 1);
  num('ambienceVolume', 0, 1);
  num('uiScale', 0.6, 2);
  num('zoom', 1, 4);
  num('particles', 0, 1);
  bool('screenShake');
  bool('showFps');
  bool('smoothLighting');
  bool('developerMode');
  bool('autosave');
  if (typeof r.multiplayerUrl === 'string') d.multiplayerUrl = r.multiplayerUrl.slice(0, 200);
  if (r.bindings && typeof r.bindings === 'object') {
    for (const k of Object.keys(d.bindings) as Action[]) {
      const v = (r.bindings as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length) d.bindings[k] = v as string[];
    }
  }
  return d;
}
