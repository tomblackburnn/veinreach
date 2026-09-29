import type { Appearance } from '../entities/player/Appearance';

export interface ShopEntry {
  item: string;
  requires?: string;
  /** Override price in aurels. */
  price?: number;
}

export interface NPCDef {
  id: string;
  role: string;
  names: string[];
  personality: string;
  look: Appearance & { hat?: string; hatTrim?: string };
  /** Arrival rule id (evaluated by NPCManager). */
  arrival: 'wallet' | 'heart' | 'flag' | 'brewer';
  arrivalFlag?: string;
  arrivalHint: string;
  lines: string[];
  nightLines: string[];
  eventLines: string[];
  /** Lines unlocked by progression flags. */
  flagLines?: Record<string, string>;
  shop: ShopEntry[];
  service?: 'heal';
}

export const NPCS: NPCDef[] = [
  {
    id: 'pedlar', role: 'Pedlar', names: ['Pell', 'Tobiah', 'Marrow', 'Quill'], personality: 'cheerful haggler',
    look: { hairStyle: 1, hairColor: '#8a5a2a', skinColor: '#eec39a', eyeColor: '#4a8a3a', shirtColor: '#d4a441', pantsColor: '#5a4a3a', shoeColor: '#3a2a1a', hat: '#6a4a8a', hatTrim: '#d4a441' },
    arrival: 'wallet', arrivalHint: 'Arrives when you have a house and at least 50 aurels.',
    lines: [
      'Torches, rope, arrows! Everything a delver needs and nothing they don’t.',
      'I once sold a bucket to a fish. It was a very confused fish.',
      'Aurels are shiny, but the stuff you can buy with them is shinier.',
      'Watch for urns underground. People used to hide their savings in them. Bad bankers, those folk.',
    ],
    nightLines: ['Shop’s open, but I’m not stepping outside. The Husks wander at night.', 'Keep your door shut tonight, friend.'],
    eventLines: ['This is terrible for business! Deal with it, would you?'],
    flagLines: { 'boss:gravelmaw': 'You killed that beetle? I’ll stock lead pellets now — word is a smith is coming to town.' },
    shop: [
      { item: 'delvers_almanac' }, { item: 'torch' }, { item: 'rope' }, { item: 'wooden_arrow' }, { item: 'lesser_mending' }, { item: 'bucket' }, { item: 'seedling' },
      { item: 'chest' }, { item: 'bed' }, { item: 'depth_gauge' }, { item: 'pocket_sundial' }, { item: 'grubbling_lure' },
      { item: 'lead_pellet', requires: 'boss:gravelmaw' }, { item: 'recall_draught', requires: 'boss:gravelmaw' },
    ],
  },
  {
    id: 'mender', role: 'Mender', names: ['Sister Maudra', 'Sister Ilse', 'Sister Wenna'], personality: 'stern but caring',
    look: { hairStyle: 2, hairColor: '#e8e8f0', skinColor: '#f6d7b8', eyeColor: '#3a5ac0', shirtColor: '#e8dcc0', pantsColor: '#e8dcc0', shoeColor: '#8a7a6a', hat: '#e8e8f0', hatTrim: '#c0404a' },
    arrival: 'heart', arrivalHint: 'Arrives once you have consumed a Vital Heart.',
    service: 'heal',
    lines: [
      'Hold still. This will only sting a little. Or a lot. Mostly a lot.',
      'Your heart is stronger than it was. Keep finding those Vital Crystals.',
      'Rest near a campfire when you can. Warmth mends more than you’d think.',
    ],
    nightLines: ['Night brings the worst injuries. Try not to be one of them.'],
    eventLines: ['Bring me the wounded. And then go and stop whatever is wounding them!'],
    flagLines: { unsealed: 'Since the Seal broke, I’ve had to brew stronger draughts. Everything out there hits harder.' },
    shop: [{ item: 'lesser_mending' }, { item: 'mending', requires: 'boss:gravelmaw' }, { item: 'regen_tonic' }, { item: 'greater_mending', requires: 'unsealed' }],
  },
  {
    id: 'smith', role: 'Smith', names: ['Brunn Ironhand', 'Hilde Anvilborn', 'Garrick Coalbeard'], personality: 'gruff craftsman',
    look: { hairStyle: 4, hairColor: '#2a1a10', skinColor: '#b97e55', eyeColor: '#6a4a2a', shirtColor: '#5a4a3a', pantsColor: '#3a3a3a', shoeColor: '#2a2a2a', hat: '#5d6474', hatTrim: '#a7b3c2' },
    arrival: 'flag', arrivalFlag: 'boss:gravelmaw', arrivalHint: 'Arrives after Gravelmaw is defeated.',
    lines: [
      'Good steel is patient steel. Unlike you, I suspect.',
      'Ferrocite anvils? Bah. In my day we hammered on rocks and liked it.',
      'Bring me something harder than Cindrite and I’ll buy you a drink.',
    ],
    nightLines: ['The forge is warm. The night is not. Stay a while.'],
    eventLines: ['Let the raiders come. My hammer’s been bored.'],
    flagLines: { unsealed: 'Umbralite and Aetherium... You’ll need an Aetherforge to work those. I’ve heard it needs void essence.' },
    shop: [
      { item: 'anvil' }, { item: 'furnace' }, { item: 'lead_pellet' }, { item: 'barbed_arrow' }, { item: 'ironclad_buckler' }, { item: 'miners_glove' },
      { item: 'frost_arrow' }, { item: 'boomstick', requires: 'boss:thornwarden' }, { item: 'cindershot', requires: 'unsealed' }, { item: 'ember_arrow', requires: 'unsealed' },
    ],
  },
  {
    id: 'alchemist', role: 'Alchemist', names: ['Olvie Brewsworth', 'Tansy Fenwick', 'Pip Alderglass'], personality: 'excitable tinkerer of tonics',
    look: { hairStyle: 7, hairColor: '#6ad0a0', skinColor: '#f6d7b8', eyeColor: '#b04fe0', shirtColor: '#7a5a8c', pantsColor: '#3a2a4a', shoeColor: '#2a1a2a', hat: '#4f8a3a', hatTrim: '#e85d9a' },
    arrival: 'brewer', arrivalHint: 'Arrives once you carry a glowshroom or any elixir.',
    lines: [
      'Did you know Glowshrooms hum when nobody’s listening? I listen.',
      'Mix petals, gel and glass and you’ve got yourself a Mending Draught. Probably.',
      'That bubbling? That’s normal. Mostly.',
    ],
    nightLines: ['The best ingredients glow in the dark. So do the worst ones.'],
    eventLines: ['I have a potion for this! It’s called “running away”.'],
    shop: [
      { item: 'glass' }, { item: 'swiftness_elixir' }, { item: 'ironskin_elixir' }, { item: 'nighteye_elixir' }, { item: 'delver_elixir' }, { item: 'glowcap_stew' },
      { item: 'fury_elixir', requires: 'boss:thornwarden' }, { item: 'precision_elixir', requires: 'boss:thornwarden' }, { item: 'emberward_elixir', requires: 'unsealed' },
    ],
  },
  {
    id: 'explorer', role: 'Explorer', names: ['Captain Wren Duskfeather', 'Captain Oda Farwind', 'Captain Lark Tessely'], personality: 'boastful adventurer',
    look: { hairStyle: 3, hairColor: '#c03a2a', skinColor: '#d9a57a', eyeColor: '#3a5ac0', shirtColor: '#3e6fa8', pantsColor: '#4a3a2a', shoeColor: '#5a3a1a', hat: '#8b5a2b', hatTrim: '#f5cf3c' },
    arrival: 'flag', arrivalFlag: 'boss:thornwarden', arrivalHint: 'Arrives after the Thornwarden is defeated.',
    lines: [
      'I’ve seen islands floating above the clouds. Build high enough and you might too.',
      'Deep in the Hollows the crystals sing. Follow the song to find the old shrines.',
      'A Warden’s Keep lies near the edge of the world. Mind the archers.',
    ],
    nightLines: ['The stars look strange lately. Brighter. Closer.'],
    eventLines: ['Now THIS is an adventure!'],
    flagLines: { unsealed: 'A violet scar has torn across the land where the Seal broke. Go see it — carefully.', 'boss:serpent': 'With the wyrm dead, I keep dreaming of a falling star with a face.' },
    shop: [
      { item: 'rope' }, { item: 'torch' }, { item: 'featherfall_pendant' }, { item: 'hunters_lens' }, { item: 'spirit_lantern' }, { item: 'homeward_compass' },
      { item: 'recall_draught' }, { item: 'gloam_lantern' }, { item: 'zephyr_charm', price: 5000 },
    ],
  },
  {
    id: 'mage', role: 'Archmage', names: ['Archmage Ysolde', 'Archmage Corvin', 'Archmage Nell Starrow'], personality: 'cryptic scholar',
    look: { hairStyle: 2, hairColor: '#e8e8f0', skinColor: '#eec39a', eyeColor: '#6fe0d0', shirtColor: '#3e4f8a', pantsColor: '#2a3558', shoeColor: '#1a2030', hat: '#2a3558', hatTrim: '#6fe0d0' },
    arrival: 'flag', arrivalFlag: 'unsealed', arrivalHint: 'Arrives after the Seal is broken.',
    lines: [
      'The Seal was not a prison for the wyrm alone. Something older slept beneath it.',
      'Mana is simply the world remembering how it was made.',
      'Offer a Brimstone Chalice in Emberdeep and the wyrm will answer. Be ready.',
    ],
    nightLines: ['Look up. Do you see how one star is brighter than it should be?'],
    eventLines: ['The veil thins. Stay close to the light.'],
    shop: [
      { item: 'apprentice_wand' }, { item: 'mana_tonic' }, { item: 'prism_shard' }, { item: 'mana_prism' }, { item: 'frostbloom_staff' }, { item: 'arcane_star', price: 2500 },
      { item: 'resonant_prism' }, { item: 'void_arrow' },
    ],
  },
  {
    id: 'tinker', role: 'Tinker', names: ['Tinker Gix', 'Tinker Nobbs', 'Tinker Rivet'], personality: 'reformed raider',
    look: { hairStyle: 5, hairColor: '#3a3a3a', skinColor: '#7a9a5a', eyeColor: '#ffe070', shirtColor: '#8a5a3a', pantsColor: '#5a4a3a', shoeColor: '#3a2a1a', hat: '#9aa0a8', hatTrim: '#c0401a' },
    arrival: 'flag', arrivalFlag: 'event:raid', arrivalHint: 'Arrives after a Rustbound Raid is repelled.',
    lines: [
      'Raiding was loud work. Tinkering is quieter. Mostly.',
      'Boots with springs in them! Why didn’t anyone think of that before? Oh. I did.',
      'Scrap is just treasure that hasn’t been introduced yet.',
    ],
    nightLines: ['My old crew is out there somewhere. Don’t tell them I’m here.'],
    eventLines: ['Uh oh. I know that horn. That’s my cousin.'],
    shop: [{ item: 'dashing_sash' }, { item: 'swiftstep_boots' }, { item: 'springheel_boots' }, { item: 'rusted_horn' }, { item: 'bucket' }, { item: 'lead_pellet' }],
  },
];

export const NPC_MAP = new Map(NPCS.map((n) => [n.id, n]));
