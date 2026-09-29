import type { WallDef } from '../world/tileTypes';

/** Background wall catalogue. Ids persisted in saves — append only. */
export const WALL_DEFS: WallDef[] = [
  { id: 0, key: 'none', name: 'None', natural: true, texture: { kind: 'sprite', base: '#000000' }, mapColor: '#000000' },
  { id: 1, key: 'loam_wall', name: 'Loam Wall', natural: true, drop: 'loam_wall', texture: { kind: 'soil', base: '#4a3020', dark: '#3a2518', light: '#553824' }, mapColor: '#3a2518' },
  { id: 2, key: 'stone_wall', name: 'Stone Wall', natural: true, drop: 'stone_wall', texture: { kind: 'stone', base: '#46464d', dark: '#38383e', light: '#52525a' }, mapColor: '#38383e' },
  { id: 3, key: 'timber_wall', name: 'Timber Wall', natural: false, drop: 'timber_wall', texture: { kind: 'planks', base: '#6a4828', dark: '#50361e', light: '#7a5530' }, mapColor: '#50361e' },
  { id: 4, key: 'stone_brick_wall', name: 'Stone Brick Wall', natural: false, drop: 'stone_brick_wall', texture: { kind: 'brick', base: '#56565e', dark: '#3e3e45', light: '#64646c', accent: '#303036' }, mapColor: '#46464d' },
  { id: 5, key: 'kiln_brick_wall', name: 'Kiln Brick Wall', natural: false, drop: 'kiln_brick_wall', texture: { kind: 'brick', base: '#6e3a2d', dark: '#522a20', light: '#7e4535', accent: '#8a7a6a' }, mapColor: '#5a3025' },
  { id: 6, key: 'sandstone_wall', name: 'Sandstone Wall', natural: true, drop: 'sandstone_wall', texture: { kind: 'stone', base: '#86683e', dark: '#6e5532', light: '#967548' }, mapColor: '#6e5532' },
  { id: 7, key: 'rime_wall', name: 'Rime Wall', natural: true, drop: 'rime_wall', texture: { kind: 'ice', base: '#5a7f9c', dark: '#476a86', light: '#6c93b0' }, mapColor: '#476a86' },
  { id: 8, key: 'mud_wall', name: 'Mud Wall', natural: true, drop: 'mud_wall', texture: { kind: 'soil', base: '#342725', dark: '#281e1c', light: '#3e2f2c' }, mapColor: '#281e1c' },
  { id: 9, key: 'hush_wall', name: 'Hushstone Wall', natural: true, drop: 'hush_wall', texture: { kind: 'stone', base: '#2f313d', dark: '#24262f', light: '#393b49' }, mapColor: '#24262f' },
  { id: 10, key: 'prism_wall', name: 'Prism Wall', natural: true, drop: 'prism_wall', texture: { kind: 'crystal', base: '#3a4560', dark: '#2c354b', light: '#4a5878' }, mapColor: '#2c354b' },
  { id: 11, key: 'ash_wall', name: 'Ash Wall', natural: true, drop: 'ash_wall', texture: { kind: 'ash', base: '#332f2f', dark: '#262323', light: '#3d3838' }, mapColor: '#262323' },
  { id: 12, key: 'warden_wall', name: 'Warden Wall', natural: true, drop: null, texture: { kind: 'brick', base: '#243847', dark: '#1a2a36', light: '#2e4657', accent: '#121d26' }, mapColor: '#1a2a36' },
  { id: 13, key: 'ember_wall', name: 'Ember Brick Wall', natural: true, drop: null, texture: { kind: 'brick', base: '#3a1c1c', dark: '#2a1212', light: '#482424', accent: '#7a3a1a' }, mapColor: '#2a1212' },
  { id: 14, key: 'blight_wall', name: 'Blight Wall', natural: true, drop: 'blight_wall', texture: { kind: 'stone', base: '#3a2e44', dark: '#2c2234', light: '#463852' }, mapColor: '#2c2234' },
  { id: 15, key: 'glass_wall', name: 'Glass Wall', natural: false, drop: 'glass_wall', texture: { kind: 'glass', base: '#6a8f9a', dark: '#4e6f7a', light: '#9ec4cf' }, mapColor: '#4e6f7a' },
  { id: 16, key: 'shard_wall', name: 'Shard Wall', natural: true, drop: 'shard_wall', texture: { kind: 'crystal', base: '#2e1f3e', dark: '#22162e', light: '#3e2a54' }, mapColor: '#22162e' },
  { id: 17, key: 'sandstone_brick_wall', name: 'Sandstone Brick Wall', natural: false, drop: 'sandstone_brick_wall', texture: { kind: 'brick', base: '#8a6c40', dark: '#6e5532', light: '#9a7a4c', accent: '#5a4428' }, mapColor: '#6e5532' },
  { id: 18, key: 'frostbrick_wall', name: 'Frostbrick Wall', natural: false, drop: 'frostbrick_wall', texture: { kind: 'brick', base: '#5f86a4', dark: '#4a6d88', light: '#7098b6', accent: '#3a566c' }, mapColor: '#4a6d88' },
  { id: 19, key: 'leaf_wall', name: 'Leafthatch Wall', natural: false, drop: 'leaf_wall', texture: { kind: 'leaves', base: '#23521b', dark: '#1a3f14', light: '#2e6524' }, mapColor: '#1a3f14' },
  { id: 20, key: 'dungeon_timber_wall', name: 'Old Timber Wall', natural: true, drop: null, texture: { kind: 'planks', base: '#4d3620', dark: '#3a2818', light: '#5a4026' }, mapColor: '#3a2818' },
];
