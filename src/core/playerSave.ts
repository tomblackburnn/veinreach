import { Player } from '../entities/player/Player';
import type { CharacterSave } from '../save/types';
import { SAVE_VERSION } from './config';
import { uid } from '../utils/dom';
import type { Appearance, Difficulty } from '../entities/player/Appearance';

/** Starting kit for a new character. */
export function newCharacter(name: string, appearance: Appearance, difficulty: Difficulty): CharacterSave {
  const main = new Array(50).fill(null);
  const kit: [string, number][] = [
    ['brasslite_blade', 1],
    ['brasslite_pickaxe', 1],
    ['brasslite_axe', 1],
    ['torch', 20],
    ['lesser_mending', 3],
    ['wood', 30],
    ['platform', 10],
  ];
  kit.forEach(([id, count], i) => (main[i] = { id, count }));
  return {
    version: SAVE_VERSION,
    id: uid(),
    name,
    appearance,
    difficulty,
    createdAt: Date.now(),
    lastPlayed: Date.now(),
    playTicks: 0,
    deaths: 0,
    baseLife: 100,
    baseMana: 40,
    life: 100,
    mana: 40,
    permadead: false,
    inventory: { main, armor: [null, null, null], accessories: [null, null, null, null, null], ammo: [null, null, null, null], trash: [null], wallet: 0, selected: 0 },
    buffs: {},
  };
}

export function applyCharacter(p: Player, c: CharacterSave): void {
  p.charId = c.id;
  p.name = c.name;
  p.appearance = { ...c.appearance };
  p.difficulty = c.difficulty;
  p.baseLife = c.baseLife;
  p.baseMana = c.baseMana;
  p.inventory.load(c.inventory);
  p.buffs.load(c.buffs);
  p.deaths = c.deaths;
  p.playTicks = c.playTicks;
  p.permadead = c.permadead;
  p.refreshStats();
  p.life = Math.max(1, Math.min(c.life, p.maxLife));
  p.mana = Math.min(c.mana, p.maxMana);
}

export function characterFromPlayer(p: Player, base: CharacterSave): CharacterSave {
  return {
    ...base,
    version: SAVE_VERSION,
    name: p.name,
    appearance: p.appearance,
    difficulty: p.difficulty,
    lastPlayed: Date.now(),
    playTicks: p.playTicks,
    deaths: p.deaths,
    baseLife: p.baseLife,
    baseMana: p.baseMana,
    life: p.dead ? p.maxLife : p.life,
    mana: p.mana,
    permadead: p.permadead,
    inventory: p.inventory.serialize(),
    buffs: p.buffs.serialize(),
  };
}
