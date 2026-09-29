/**
 * Content for the Delver's Almanac (in-game guidebook). All item/boss ids are
 * validated by tests so the guide can never point at something that
 * doesn't exist.
 */

export interface GuideStage {
  id: string;
  title: string;
  /** Boss this stage builds toward (null for the final stage). */
  nextBoss: string | null;
  /** Flag that marks this stage as completed. */
  doneFlag: string | null;
  summary: string;
  goals: string[];
  armor: string[];
  pickaxe: string;
  melee: string[];
  ranged: string[];
  magic: string[];
  summon: string[];
  accessories: string[];
  potions: string[];
}

export const GUIDE_STAGES: GuideStage[] = [
  {
    id: 'start', title: 'I. First Steps', nextBoss: 'gravelmaw', doneFlag: 'boss:gravelmaw',
    summary: 'Survive your first nights, build a home and gear up in Brasslite and Ferrocite.',
    goals: [
      'Chop trees for Timber and craft a Workbench (by hand).',
      'Build a house: walls behind, a door, a torch, a table and a chair. The Pedlar arrives once you carry 50 aurels.',
      'Mine Brasslite and Ferrocite ore. Build a Smelter (stone + wood + torches) and an Anvil.',
      'Explore caves for chests, urns and Vital Crystals (red hearts). Each Vital Heart adds 20 max life.',
      'Craft Ferrocite armour and a Ferrocite Pickaxe.',
      'Craft a Grubbling Lure (gel + ferrocite + loam) or find one from Tunnel Grubs, then use it underground.',
    ],
    armor: ['brasslite', 'ferrocite'], pickaxe: 'ferrocite_pickaxe',
    melee: ['brasslite_blade', 'ferrocite_broadsword'], ranged: ['ferrocite_bow', 'wooden_arrow'], magic: ['apprentice_wand'], summon: ['wisp_rod'],
    accessories: ['swiftstep_boots', 'springheel_boots', 'featherfall_pendant', 'menders_band', 'hunters_lens'],
    potions: ['lesser_mending', 'ironskin_elixir', 'swiftness_elixir'],
  },
  {
    id: 'gravelmaw', title: 'II. The Deep Delve', nextBoss: 'thornwarden', doneFlag: 'boss:thornwarden',
    summary: 'With Gravelmaw slain, the Smith arrives. Push into the caverns for Moonsilver and Sungild.',
    goals: [
      'Forge Gravelmaw Chitin into the Gravelmaw set or the Mandible pickaxe.',
      'Mine Moonsilver and Sungild in the caverns and deep layers.',
      'Craft an Alembic Bench and brew Mending Draughts and elixirs.',
      'Find a Zephyr Charm (double jump) or Dashing Sash in cavern chests.',
      'Craft a Withered Seed (seedlings + gloam dust or bones + blightrock) and plant it on the surface at night.',
    ],
    armor: ['chitin', 'moonsilver'], pickaxe: 'chitin_drill',
    melee: ['gravelcrusher', 'moonsilver_saber', 'riftrang'], ranged: ['brass_arbalest', 'barbed_arrow'], magic: ['frostbloom_staff'], summon: ['wisp_rod'],
    accessories: ['zephyr_charm', 'dashing_sash', 'burrowers_carapace', 'ironclad_buckler', 'stonehide_charm'],
    potions: ['mending', 'ironskin_elixir', 'regen_tonic'],
  },
  {
    id: 'thornwarden', title: 'III. The Singing Crystals', nextBoss: 'obelisk', doneFlag: 'boss:obelisk',
    summary: 'The blight recedes and the Explorer arrives. Seek the Glimmer Hollows deep underground.',
    goals: [
      'Craft Thornbark gear from the Heartwood of the Warden.',
      'Get a Sungild Pickaxe (power 62) so you can mine Glimmerite in the Glimmer Hollows.',
      'Smelt Glimmer Bars (glimmerite + prism shards) for the Glimmer Pickaxe, Glimmerbrand and Glimmer armour.',
      'Build a Runescribe Desk for magic gear and the Mana Prism.',
      'Craft a Resonant Prism (prism shards + glimmer bars) and use it in the deep caverns.',
      'Warning: destroying Obelisk Prime breaks the Seal and makes the whole world harder.',
    ],
    armor: ['sungild', 'glimmer', 'thornbark'], pickaxe: 'glimmer_pickaxe',
    melee: ['thornlash', 'glimmerbrand', 'sungild_greatsword'], ranged: ['sungild_longbow', 'boomstick', 'barbed_arrow'], magic: ['verdant_scepter', 'prismatic_staff'], summon: ['wisp_rod'],
    accessories: ['seedcrown', 'voyager_treads', 'mana_prism', 'zephyr_charm', 'keen_monocle'],
    potions: ['mending', 'fury_elixir', 'precision_elixir'],
  },
  {
    id: 'obelisk', title: 'IV. After the Unsealing', nextBoss: 'serpent', doneFlag: 'boss:serpent',
    summary: 'The Seal is broken. Umbralite and Aetherium lie deep; a violet Shardblight scar cuts the land.',
    goals: [
      'Descend to Emberdeep with an Emberward Elixir or Ember Sigil, and mine Cindrite with the Glimmer Pickaxe.',
      'Craft Cindrite (Cinder) armour and the Cinderpick (power 100) to mine Umbralite.',
      'Hunt Shardlings and Voidwraiths for Void Essence, then build the Aetherforge.',
      'Forge Umbral gear, then the Umbral Pickaxe (power 120) to mine Aetherium.',
      'Craft a Brimstone Chalice (cindrite + void essence + ember cores) and offer it in Emberdeep.',
    ],
    armor: ['cinder', 'umbral'], pickaxe: 'umbral_pickaxe',
    melee: ['emberlance', 'umbral_reaver'], ranged: ['cinderstring', 'shardrepeater', 'ember_arrow'], magic: ['tome_of_embers', 'voidcaller_codex'], summon: ['shardcaller'],
    accessories: ['ember_sigil', 'resonant_core', 'aurora_mantle', 'voyager_treads', 'dashing_sash'],
    potions: ['greater_mending', 'emberward_elixir', 'fury_elixir'],
  },
  {
    id: 'serpent', title: 'V. The Falling Star', nextBoss: 'solmara', doneFlag: 'boss:solmara',
    summary: 'The Emberwyrm is dead. Something in the night sky is watching.',
    goals: [
      'Craft Aether armour and the Aether Pickaxe.',
      'Gather Starshard from Starfall events (fallen stars crash at night).',
      'Build the Starloom (aether bars + serpent scales + starshard).',
      'Craft an Astral Sigil and raise it on the surface at night. Build a flat arena first: Solmara will lock you inside a ring.',
    ],
    armor: ['aether'], pickaxe: 'aether_pickaxe',
    melee: ['serpentfang_glaive', 'umbral_reaver'], ranged: ['wyrmstring', 'void_arrow'], magic: ['voidcaller_codex'], summon: ['wyrmling_staff'],
    accessories: ['wyrm_heart', 'aurora_mantle', 'resonant_core', 'voyager_treads', 'seedcrown'],
    potions: ['greater_mending', 'regen_tonic', 'precision_elixir'],
  },
  {
    id: 'solmara', title: 'VI. Beyond the Seal', nextBoss: null, doneFlag: null,
    summary: 'The Unmade Star is extinguished. Forge Starsteel and enjoy the strongest gear in Veinreach.',
    goals: ['Smelt Starsteel Bars at the Starloom from Starheart Fragments.', 'Craft the Starforged set.', 'Rematch any boss by crafting its summon item again.'],
    armor: ['starforged'], pickaxe: 'aether_pickaxe',
    melee: ['starfall_edge'], ranged: ['astral_volley', 'cindershot'], magic: ['astral_scepter'], summon: ['wyrmling_staff'],
    accessories: ['aurora_mantle', 'wyrm_heart', 'resonant_core', 'voyager_treads', 'seedcrown'],
    potions: ['greater_mending', 'fury_elixir'],
  },
];

export interface BossGuide {
  where: string;
  strategy: string[];
  recommended: string;
}

export const BOSS_GUIDE: Record<string, BossGuide> = {
  gravelmaw: {
    where: 'Anywhere underground. A wide, flat cave works best.',
    recommended: 'Ferrocite armour, 160+ life, a bow or broadsword.',
    strategy: [
      'It shakes before charging: jump over it. Charges that hit a wall stun it; hit it hard while it is dazed.',
      'After a leap it sends out a shockwave. Jump as it lands.',
      'When the ground trembles it is burrowing toward you. Keep moving when the dust trail appears.',
      'Below half health it enrages and summons Grublings.',
    ],
  },
  thornwarden: {
    where: 'On the surface at night. It leaves at dawn.',
    recommended: 'Chitin or Moonsilver armour, 200+ life, the Zephyr Charm, ranged or magic weapons.',
    strategy: [
      'Purple marks on the ground become root spikes. Step off them.',
      'Seed bombs burst into thorns; stay mobile rather than trying to dodge each one.',
      'Below half health it dashes along a violet line: move off the line when it appears.',
      'Kill Thornlings quickly; they chip away at you.',
    ],
  },
  obelisk: {
    where: 'The deep caverns or the Glimmer Hollows.',
    recommended: 'Sungild or Glimmer armour, 260+ life, double jump, a fast ranged or magic weapon.',
    strategy: [
      'A dashed line means a laser is coming. It sweeps, so move perpendicular to it.',
      'After every laser it OVERHEATS: its defense drops to 0 for a few seconds. Unload everything then.',
      'Watch for the shard cage (phase 2): move to a gap before the shards fire inward.',
      'Phase 3 adds rotating cross-lasers; circle with them.',
      'Destroying it breaks the Seal. Prepare, because the world becomes harder.',
    ],
  },
  serpent: {
    where: 'Emberdeep (the bottom of the world), after the Unsealing.',
    recommended: 'Cinder or Umbral armour, 340+ life, the Ember Sigil, piercing weapons (spears, bows).',
    strategy: [
      'It swims through stone. Piercing weapons hit many segments at once, and every segment damages the head.',
      'When it circles you, embers fire from its body. Keep moving and heal early.',
      'A glowing column marks a dive from above: step out of the column.',
      'When it slows and faces you it is about to breathe fire. Get behind it.',
    ],
  },
  solmara: {
    where: 'The surface at night, after Nhal’Zyra. Build a large flat arena first.',
    recommended: 'Aether armour, 400 life, the Aurora Mantle and Wyrm Heart, your best weapon, plenty of Greater Mending Draughts.',
    strategy: [
      'Phase 1: star rings and teleport-dashes. A flashing circle shows where she will appear.',
      'Phase 2 (two-thirds health): a ring locks the arena, so stay inside it. Rotating lasers sweep; circle with them. Meteors fall where columns glow.',
      'Phase 3 (one-third health): the supernova. Survive the spiral, then she is EXHAUSTED with 0 defense. That is your window.',
      'She flees at sunrise, so start early in the night.',
    ],
  },
};

export const STATION_GUIDE: { item: string; how: string; makes: string }[] = [
  { item: 'workbench', how: '10 Timber, by hand', makes: 'Furniture, wooden gear, arrows, walls, boss summons' },
  { item: 'furnace', how: 'Stone, Timber and torches at a Workbench', makes: 'Bars, bricks, glass' },
  { item: 'anvil', how: 'Ferrocite (or Brasslite) bars at a Workbench', makes: 'Metal tools, weapons, armour, accessories' },
  { item: 'alembic', how: 'Glass, Timber and Brasslite bars at a Workbench', makes: 'Draughts, elixirs, stew' },
  { item: 'runescribe', how: 'Timber, Moonsilver bars and prism shards at an Anvil', makes: 'Magic weapons, mana gear, combined accessories' },
  { item: 'aetherforge', how: 'Cindrite, Void Essence and Arcane Cores at an Anvil (after the Unsealing)', makes: 'Umbral and Aether gear, Brimstone Chalice' },
  { item: 'starloom', how: 'Aether bars, Serpent Scales and Starshard at the Aetherforge', makes: 'Starsteel and Starforged gear' },
];

export const ORE_GUIDE: { ore: string; where: string }[] = [
  { ore: 'brasslite_ore', where: 'Near the surface and underground' },
  { ore: 'ferrocite_ore', where: 'Underground and caverns' },
  { ore: 'moonsilver_ore', where: 'Caverns and deeper' },
  { ore: 'sungild_ore', where: 'Deep caverns (the Hush)' },
  { ore: 'glimmerite_ore', where: 'Glimmer Hollows (crystal caves deep down)' },
  { ore: 'cindrite_ore', where: 'Emberdeep (bring fire protection)' },
  { ore: 'starshard_ore', where: 'Craters from Starfall events' },
  { ore: 'umbralite_ore', where: 'Caverns and deeper, after the Unsealing' },
  { ore: 'aetherium_ore', where: 'Deep caverns, after the Unsealing' },
];

export const GUIDE_TIPS: string[] = [
  'Hold Space longer to jump higher. Hold S to drop through platforms. Climb ropes with W/S.',
  'Right-click doors, chests and beds. Right-clicking a bed sets your spawn point.',
  'Shift-click moves whole stacks; Ctrl-click trashes. Right-click armour in your bag to equip it.',
  'Press H to drink your best healing draught and J for mana. Healing draughts cause Draught Sickness for 45 seconds.',
  'Stand near crafting stations: recipes appear automatically in the crafting panel (E).',
  'Urns hide aurels, potions and ammo. Break them with any tool or weapon.',
  'Lurker Chests look like normal chests underground. Be wary of chests sitting in odd places.',
  'Campfires grant a Cozy Fire regeneration buff nearby.',
  'Enemies never spawn inside rooms with player-placed walls: houses are safe.',
  'Press M for the world map. Structures you discover are labelled on it.',
];
