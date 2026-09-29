export type Difficulty = 'wanderer' | 'delver' | 'ironsoul' | 'creative';

export const DIFFICULTIES: Record<Difficulty, { name: string; description: string }> = {
  wanderer: { name: 'Wanderer', description: 'Drop half your aurels on death.' },
  delver: { name: 'Delver', description: 'Drop all carried items on death.' },
  ironsoul: { name: 'Ironsoul', description: 'Death is permanent.' },
  creative: { name: 'Creative', description: 'Sandbox for testing: press C for items, spawners and world controls. No death penalty.' },
};

export interface Appearance {
  hairStyle: number;
  hairColor: string;
  skinColor: string;
  eyeColor: string;
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
}

export const HAIR_STYLES = 8;
export const SKIN_TONES = ['#f6d7b8', '#eec39a', '#d9a57a', '#b97e55', '#8d5a3a', '#5e3b26', '#c9e0b0', '#b0c4e0'];
export const HAIR_COLORS = ['#2a1a10', '#5a3a1a', '#a0602a', '#e0b050', '#f0e0b0', '#c03a2a', '#e8e8f0', '#4a6ad0', '#6ad0a0', '#b04fe0'];
export const CLOTH_COLORS = ['#b8434a', '#3e6fa8', '#4f8a3a', '#d4a441', '#7a5a8c', '#e8dcc0', '#3a3a44', '#d86a2a', '#2a8a8a', '#e85d9a'];

export function defaultAppearance(): Appearance {
  return {
    hairStyle: 1,
    hairColor: HAIR_COLORS[2],
    skinColor: SKIN_TONES[1],
    eyeColor: '#3a5ac0',
    shirtColor: CLOTH_COLORS[1],
    pantsColor: '#4a3a2a',
    shoeColor: '#3a2a1a',
  };
}

export function randomAppearance(): Appearance {
  const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return {
    hairStyle: Math.floor(Math.random() * HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    skinColor: pick(SKIN_TONES.slice(0, 6)),
    eyeColor: pick(['#3a5ac0', '#4a8a3a', '#6a4a2a', '#8a8a9a']),
    shirtColor: pick(CLOTH_COLORS),
    pantsColor: pick(['#4a3a2a', '#2a3a5a', '#3a3a3a', '#5a4a3a']),
    shoeColor: pick(['#3a2a1a', '#2a2a2a', '#5a3a1a']),
  };
}

export function sanitizeAppearance(raw: unknown): Appearance {
  const d = defaultAppearance();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const col = (k: keyof Appearance) => {
    const v = r[k];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) (d as unknown as Record<string, unknown>)[k] = v;
  };
  if (typeof r.hairStyle === 'number') d.hairStyle = Math.max(0, Math.min(HAIR_STYLES - 1, Math.floor(r.hairStyle)));
  (['hairColor', 'skinColor', 'eyeColor', 'shirtColor', 'pantsColor', 'shoeColor'] as const).forEach(col);
  return d;
}
