/** Boss catalogue. Behaviour lives in entities/bosses/<Boss>.ts. */
export interface BossDef {
  id: string;
  name: string;
  title: string;
  life: number;
  defense: number;
  damage: number;
  w: number;
  h: number;
  music: string;
  loot: string;
  summonItem: string;
  summonHint: string;
  lore: string;
  colors: string[];
}

export const BOSSES: BossDef[] = [
  {
    id: 'gravelmaw', name: 'Gravelmaw', title: 'the Burrowing Tyrant', life: 2400, defense: 8, damage: 22, w: 108, h: 66, music: 'boss1', loot: 'boss_gravelmaw',
    summonItem: 'grubbling_lure', summonHint: 'Use a Grubbling Lure anywhere underground.',
    lore: 'A beetle the size of a house that has eaten its way through the Underlayers for a thousand years.',
    colors: ['#8a6a4a', '#c0a070', '#4a3020', '#ff6a3a'],
  },
  {
    id: 'thornwarden', name: 'The Thornwarden', title: 'Rot of the Old Grove', life: 4200, defense: 12, damage: 30, w: 96, h: 96, music: 'boss2', loot: 'boss_thornwarden',
    summonItem: 'withered_seed', summonHint: 'Plant a Withered Seed on the surface at night.',
    lore: 'Once the guardian spirit of the forest, now hollowed by the blight seeping up from below.',
    colors: ['#6a8a3a', '#3a2a1a', '#b06adf', '#e0ff90'],
  },
  {
    id: 'obelisk', name: 'Obelisk Prime', title: 'Warden of the Seal', life: 7500, defense: 22, damage: 38, w: 56, h: 104, music: 'boss3', loot: 'boss_obelisk',
    summonItem: 'resonant_prism', summonHint: 'Use a Resonant Prism in the deep caverns or the Glimmer Hollows.',
    lore: 'A thinking engine built to keep the Seal closed. Destroying it will break the Seal.',
    colors: ['#2a3558', '#6fe0d0', '#d4fff8', '#9ff5ff'],
  },
  {
    id: 'serpent', name: 'Nhal’Zyra', title: 'the Emberwyrm', life: 16000, defense: 30, damage: 55, w: 40, h: 40, music: 'boss4', loot: 'boss_serpent',
    summonItem: 'brimstone_chalice', summonHint: 'Offer a Brimstone Chalice in Emberdeep after the Unsealing.',
    lore: 'Freed when the Seal broke, the wyrm swims through stone as easily as through fire.',
    colors: ['#c0401a', '#ff8a3a', '#5a1a10', '#ffe070'],
  },
  {
    id: 'solmara', name: 'Solmara', title: 'the Unmade Star', life: 32000, defense: 40, damage: 70, w: 60, h: 80, music: 'boss5', loot: 'boss_solmara',
    summonItem: 'astral_sigil', summonHint: 'Raise an Astral Sigil to the night sky after defeating Nhal’Zyra.',
    lore: 'The Seal did not hold a monster. It held a star that refused to die.',
    colors: ['#fff0a0', '#ff8ae6', '#9ff5ff', '#ffffff'],
  },
];

export const BOSS_MAP = new Map(BOSSES.map((b) => [b.id, b]));
