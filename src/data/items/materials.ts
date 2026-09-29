import type { ItemDef } from '../../items/types';
import { material } from './helpers';

const bar = (id: string, name: string, color: string, value: number, rarity: number) => material(id, name, { t: 'bar', c: [color] }, value, rarity);

export const MATERIAL_ITEMS: ItemDef[] = [
  bar('brasslite_bar', 'Brasslite Bar', '#e0923d', 15, 0),
  bar('ferrocite_bar', 'Ferrocite Bar', '#a7b3c2', 30, 0),
  bar('moonsilver_bar', 'Moonsilver Bar', '#cfe0ff', 50, 1),
  bar('sungild_bar', 'Sungild Bar', '#f5cf3c', 75, 1),
  bar('glimmer_bar', 'Glimmer Bar', '#6fe0d0', 110, 2),
  bar('cindrite_bar', 'Cindrite Bar', '#ff6a2a', 150, 3),
  bar('umbral_bar', 'Umbral Bar', '#8a3cd6', 260, 5),
  bar('aether_bar', 'Aether Bar', '#9ff5ff', 380, 6),
  bar('starsteel_bar', 'Starsteel Bar', '#ff8ae6', 600, 7),
  material('gel', 'Gloop Gel', { t: 'gel', c: ['#6ad04a'] }, 1, 0, 'Sticky and slightly flammable.'),
  material('bone', 'Bone', { t: 'bone', c: ['#e6dcc4'] }, 2),
  material('silk', 'Silk', { t: 'silk', c: ['#e8e8f0'] }, 2),
  material('prism_shard', 'Prism Shard', { t: 'shard', c: ['#8ff0ff', '#ffffff'] }, 8, 1, 'Hums at a pitch only crystals hear.'),
  material('membrane', 'Duskwing Membrane', { t: 'scale', c: ['#5a4a6a', '#8a7a9a'] }, 4),
  material('fang', 'Frostfang', { t: 'fang', c: ['#e8f0ff', '#8fc4ea'] }, 6),
  material('ember_core', 'Ember Core', { t: 'orb', c: ['#ff6a2a', '#ffe070'] }, 20, 2),
  material('spore_sac', 'Spore Sac', { t: 'gel', c: ['#7ad060'] }, 4),
  material('shell_plate', 'Rockback Plate', { t: 'scale', c: ['#8a7f78', '#5a524d'] }, 8),
  material('lantern_wick', 'Lantern Wick', { t: 'orb', c: ['#ffe070', '#ff9a40'] }, 5),
  material('scrap', 'Rustbound Scrap', { t: 'scale', c: ['#9aa0a8', '#8a5a3a'] }, 6),
  material('void_essence', 'Void Essence', { t: 'orb', c: ['#a64cff', '#1a0a2a'] }, 30, 5, 'The residue of the broken Seal.'),
  material('gloam_dust', 'Gloam Dust', { t: 'dust', c: ['#8a60c0'] }, 10, 2),
  // Boss materials
  material('chitin_plate', 'Gravelmaw Chitin', { t: 'scale', c: ['#8a6a4a', '#c0a070'] }, 40, 2, 'Harder than stone, lighter than wood.'),
  material('warden_bark', 'Heartwood of the Warden', { t: 'wood', c: ['#6a8a3a', '#3a2a1a'] }, 50, 3),
  material('arcane_core', 'Arcane Core', { t: 'core', c: ['#6fe0d0', '#2a3558'] }, 80, 4, 'Still warm with the Obelisk’s thoughts.'),
  material('serpent_scale', 'Serpent Scale', { t: 'scale', c: ['#ff8a3a', '#5a1a10'] }, 120, 6),
  material('starheart', 'Starheart Fragment', { t: 'star', c: ['#fff0a0', '#ff8ae6'] }, 250, 8, 'A shard of something that should never have fallen.'),
];
