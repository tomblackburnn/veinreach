/**
 * Loot tables for chests, urns, enemies and bosses.
 *
 * - `always`: every entry drops (subject to its own `chance`, default 1)
 * - `pools`: pick `count` entries by `weight` from each pool
 * - `aurels`: currency range
 * Entries may be gated on world progression flags with `requires` / `excludes`.
 */
export interface LootEntry {
  item: string;
  min?: number;
  max?: number;
  chance?: number;
  weight?: number;
  requires?: string;
  excludes?: string;
}

export interface LootPool {
  count: [number, number];
  entries: LootEntry[];
}

export interface LootTable {
  always?: LootEntry[];
  pools?: LootPool[];
  aurels?: [number, number];
}

const common = (min = 3, max = 8): LootPool => ({
  count: [2, 4],
  entries: [
    { item: 'torch', min: 5, max: 15, weight: 3 },
    { item: 'lesser_mending', min: 1, max: 3, weight: 3 },
    { item: 'wooden_arrow', min: 15, max: 40, weight: 2 },
    { item: 'rope', min: 10, max: 30, weight: 2 },
    { item: 'brasslite_bar', min, max, weight: 2 },
    { item: 'ferrocite_bar', min, max, weight: 2 },
    { item: 'recall_draught', min: 1, max: 2, weight: 1 },
    { item: 'mushroom', min: 2, max: 5, weight: 1 },
  ],
});

export const LOOT_TABLES: Record<string, LootTable> = {
  // --- Chests ---
  chest_surface: {
    pools: [
      { count: [1, 1], entries: [{ item: 'spineblade' }, { item: 'timber_bow' }, { item: 'apprentice_wand' }, { item: 'springheel_boots' }, { item: 'miners_glove' }] },
      common(),
    ],
    aurels: [20, 80],
  },
  chest_underground: {
    pools: [
      {
        count: [1, 1],
        entries: [
          { item: 'swiftstep_boots' }, { item: 'featherfall_pendant' }, { item: 'menders_band' }, { item: 'keen_monocle' },
          { item: 'stonehide_charm' }, { item: 'hunters_lens' }, { item: 'depth_gauge' }, { item: 'pocket_sundial' }, { item: 'spirit_lantern' },
        ],
      },
      common(),
      { count: [0, 1], entries: [{ item: 'swiftness_elixir', max: 2 }, { item: 'nighteye_elixir', max: 2 }, { item: 'delver_elixir', max: 2 }, { item: 'ironskin_elixir', max: 2 }] },
    ],
    aurels: [40, 150],
  },
  chest_cavern: {
    pools: [
      {
        count: [1, 1],
        entries: [
          { item: 'zephyr_charm' }, { item: 'dashing_sash' }, { item: 'riftrang' }, { item: 'mana_prism' }, { item: 'ironclad_buckler' },
          { item: 'frostbloom_staff' }, { item: 'wisp_rod' },
        ],
      },
      common(4, 10),
      { count: [1, 2], entries: [{ item: 'swiftness_elixir', max: 2 }, { item: 'nighteye_elixir', max: 2 }, { item: 'regen_tonic', max: 2 }, { item: 'fury_elixir', max: 2 }, { item: 'barbed_arrow', min: 20, max: 50 }] },
    ],
    always: [{ item: 'arcane_star', chance: 0.35 }],
    aurels: [80, 250],
  },
  chest_deep: {
    pools: [
      { count: [1, 1], entries: [{ item: 'zephyr_charm' }, { item: 'dashing_sash' }, { item: 'riftrang' }, { item: 'boomstick' }, { item: 'ember_sigil' }] },
      { count: [2, 4], entries: [{ item: 'moonsilver_bar', min: 4, max: 9 }, { item: 'sungild_bar', min: 3, max: 8 }, { item: 'mending', min: 1, max: 3 }, { item: 'precision_elixir', max: 2 }, { item: 'frost_arrow', min: 20, max: 50 }] },
    ],
    always: [{ item: 'arcane_star', chance: 0.5 }],
    aurels: [150, 400],
  },
  chest_sky: {
    pools: [{ count: [1, 1], entries: [{ item: 'zephyr_charm', weight: 3 }, { item: 'featherfall_pendant', weight: 2 }, { item: 'sungild_longbow' }, { item: 'springheel_boots' }] }, common()],
    always: [{ item: 'sungild_brick', min: 20, max: 40, chance: 0.5 }],
    aurels: [100, 250],
  },
  chest_vault: {
    pools: [
      { count: [1, 1], entries: [{ item: 'brass_arbalest' }, { item: 'swiftstep_boots' }, { item: 'keen_monocle' }, { item: 'riftrang' }] },
      common(),
      { count: [1, 1], entries: [{ item: 'sungild_bar', min: 3, max: 6 }, { item: 'sandstone_brick', min: 30, max: 60 }] },
    ],
    aurels: [60, 200],
  },
  chest_hollow: {
    pools: [
      { count: [1, 1], entries: [{ item: 'prismatic_staff', weight: 2 }, { item: 'mana_prism', weight: 2 }, { item: 'glimmerbrand' }] },
      { count: [2, 3], entries: [{ item: 'prism_shard', min: 4, max: 10 }, { item: 'glimmer_bar', min: 2, max: 5 }, { item: 'mana_tonic', min: 2, max: 5 }] },
    ],
    always: [{ item: 'arcane_star' }],
    aurels: [200, 500],
  },
  chest_keep: {
    pools: [
      { count: [1, 1], entries: [{ item: 'boomstick' }, { item: 'riftrang' }, { item: 'dashing_sash' }, { item: 'ironclad_buckler' }, { item: 'tome_of_embers' }, { item: 'wisp_rod' }] },
      { count: [2, 4], entries: [{ item: 'bone', min: 5, max: 20 }, { item: 'mending', min: 1, max: 3 }, { item: 'lead_pellet', min: 50, max: 120 }, { item: 'fury_elixir', max: 2 }, { item: 'moonsilver_bar', min: 3, max: 8 }] },
    ],
    aurels: [200, 600],
  },
  chest_ember: {
    pools: [
      { count: [1, 1], entries: [{ item: 'tome_of_embers' }, { item: 'cinderstring' }, { item: 'ember_sigil' }, { item: 'emberlance' }] },
      { count: [2, 4], entries: [{ item: 'cindrite_bar', min: 3, max: 8 }, { item: 'ember_arrow', min: 20, max: 60 }, { item: 'emberward_elixir', max: 3 }, { item: 'mending', min: 2, max: 4 }] },
    ],
    aurels: [400, 900],
  },
  // --- Urns ---
  pot_shallow: {
    pools: [{ count: [1, 1], entries: [{ item: 'torch', min: 2, max: 6, weight: 3 }, { item: 'lesser_mending', weight: 2 }, { item: 'wooden_arrow', min: 5, max: 15, weight: 2 }, { item: 'rope', min: 4, max: 10 }, { item: 'aurel', min: 5, max: 20, weight: 3 }] }],
  },
  pot_deep: {
    pools: [{ count: [1, 2], entries: [{ item: 'torch', min: 3, max: 8, weight: 2 }, { item: 'mending', weight: 2 }, { item: 'barbed_arrow', min: 8, max: 20, weight: 2 }, { item: 'lead_pellet', min: 10, max: 25 }, { item: 'aurel', min: 20, max: 60, weight: 3 }, { item: 'nighteye_elixir' }] }],
  },
  // --- Enemies ---
  e_gloop: { always: [{ item: 'gel', min: 1, max: 3 }], aurels: [1, 5] },
  e_burrbeetle: { always: [{ item: 'shell_plate', chance: 0.2 }], aurels: [2, 8] },
  e_husk: { always: [{ item: 'bone', chance: 0.4, max: 2 }, { item: 'mushroom', chance: 0.1 }], aurels: [3, 10] },
  e_duskwing: { always: [{ item: 'membrane', chance: 0.6 }], aurels: [2, 8] },
  e_nightlantern: { always: [{ item: 'lantern_wick', chance: 0.5 }, { item: 'gloam_lantern', chance: 0.02 }], aurels: [4, 12] },
  e_sandlurker: { always: [{ item: 'shell_plate', chance: 0.5 }, { item: 'swiftstep_boots', chance: 0.01 }], aurels: [5, 15] },
  e_frostfang: { always: [{ item: 'fang', chance: 0.6, max: 2 }], aurels: [5, 15] },
  e_bogshambler: { always: [{ item: 'spore_sac', chance: 0.5 }, { item: 'gel', max: 2 }], aurels: [4, 12] },
  e_webskitter: { always: [{ item: 'silk', min: 1, max: 3 }], aurels: [5, 15] },
  e_rockback: { always: [{ item: 'shell_plate', min: 1, max: 2 }, { item: 'stonehide_charm', chance: 0.02 }], aurels: [8, 20] },
  e_tunnelgrub: { always: [{ item: 'grubbling_lure', chance: 0.05 }], aurels: [5, 15] },
  e_ossuary_archer: { always: [{ item: 'bone', min: 1, max: 3 }, { item: 'wooden_arrow', min: 3, max: 10, chance: 0.5 }, { item: 'ferrocite_bow', chance: 0.02 }], aurels: [10, 25] },
  e_hexcaller: { always: [{ item: 'mana_tonic', chance: 0.2 }, { item: 'apprentice_wand', chance: 0.03 }], aurels: [15, 35] },
  e_crystal_mote: { always: [{ item: 'prism_shard', min: 1, max: 2 }, { item: 'resonant_prism', chance: 0.02, excludes: 'boss:obelisk' }], aurels: [15, 35] },
  e_lurker_chest: { pools: [{ count: [1, 1], entries: [{ item: 'dashing_sash' }, { item: 'zephyr_charm' }, { item: 'riftrang' }, { item: 'ironclad_buckler' }] }], aurels: [150, 300] },
  e_sporecap: { always: [{ item: 'spore_sac', min: 1, max: 2 }, { item: 'glowshroom', chance: 0.5, max: 3 }], aurels: [8, 20] },
  e_cinder_imp: { always: [{ item: 'ember_core', chance: 0.35 }, { item: 'brimstone_chalice', chance: 0.03, requires: 'unsealed' }], aurels: [20, 45] },
  e_magma_gloop: { always: [{ item: 'gel', min: 2, max: 4 }, { item: 'ember_core', chance: 0.15 }], aurels: [15, 30] },
  e_ashen_knight: { always: [{ item: 'cindrite_bar', chance: 0.25, max: 2 }, { item: 'ember_core', chance: 0.3 }], aurels: [30, 60] },
  e_shardling: { always: [{ item: 'void_essence', chance: 0.5 }, { item: 'prism_shard', chance: 0.5 }], aurels: [30, 60] },
  e_voidwraith: { always: [{ item: 'void_essence', min: 1, max: 2 }, { item: 'astral_sigil', chance: 0.02, requires: 'boss:serpent' }], aurels: [40, 80] },
  e_gloam_stalker: { always: [{ item: 'gloam_dust', min: 1, max: 3 }, { item: 'withered_seed', chance: 0.05, excludes: 'boss:thornwarden' }], aurels: [15, 35] },
  e_scrapjack: { always: [{ item: 'scrap', min: 1, max: 3 }, { item: 'rusted_horn', chance: 0.02 }], aurels: [15, 35] },
  e_scrapjack_slinger: { always: [{ item: 'scrap', min: 1, max: 2 }, { item: 'lead_pellet', min: 5, max: 15 }, { item: 'boomstick', chance: 0.03 }], aurels: [15, 35] },
  e_scrapjack_brute: { always: [{ item: 'scrap', min: 3, max: 6 }, { item: 'ironclad_buckler', chance: 0.05 }], aurels: [40, 80] },
  // --- Bosses ---
  boss_gravelmaw: {
    always: [{ item: 'chitin_plate', min: 12, max: 20 }, { item: 'mending', min: 5, max: 5 }, { item: 'burrowers_carapace', chance: 0.5 }],
    pools: [{ count: [1, 1], entries: [{ item: 'gravelcrusher' }, { item: 'chitin_drill' }] }],
    aurels: [800, 1200],
  },
  boss_thornwarden: {
    always: [{ item: 'warden_bark', min: 10, max: 16 }, { item: 'mending', min: 5, max: 5 }, { item: 'seedcrown', chance: 0.5 }],
    pools: [{ count: [1, 1], entries: [{ item: 'thornlash' }, { item: 'verdant_scepter' }] }],
    aurels: [1200, 1800],
  },
  boss_obelisk: {
    always: [{ item: 'arcane_core', min: 6, max: 10 }, { item: 'greater_mending', min: 5, max: 5 }, { item: 'resonant_core', chance: 0.5 }],
    pools: [{ count: [1, 1], entries: [{ item: 'shardrepeater' }, { item: 'shardcaller' }, { item: 'prismatic_staff' }] }],
    aurels: [2500, 3500],
  },
  boss_serpent: {
    always: [{ item: 'serpent_scale', min: 12, max: 18 }, { item: 'greater_mending', min: 8, max: 8 }, { item: 'wyrm_heart', chance: 0.5 }],
    pools: [{ count: [1, 1], entries: [{ item: 'serpentfang_glaive' }, { item: 'wyrmstring' }, { item: 'wyrmling_staff' }] }],
    aurels: [5000, 7000],
  },
  boss_solmara: {
    always: [{ item: 'starheart', min: 20, max: 30 }, { item: 'greater_mending', min: 10, max: 10 }],
    pools: [{ count: [1, 1], entries: [{ item: 'starfall_edge' }, { item: 'astral_volley' }, { item: 'astral_scepter' }] }],
    aurels: [12000, 15000],
  },
};
