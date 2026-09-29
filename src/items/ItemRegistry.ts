import { ALL_ITEMS } from '../data/items';
import { PROJECTILES, type ProjectileDef } from '../data/projectiles';
import { TileRegistry } from '../world/TileRegistry';
import type { ItemDef } from './types';

/** Placeholder used when a save references an item that no longer exists. */
const UNKNOWN: ItemDef = {
  id: 'unknown',
  name: 'Unknown Item',
  description: 'This item could not be recognised.',
  category: 'material',
  rarity: 0,
  maxStack: 999,
  value: 0,
  icon: { t: 'unknown' },
};

class ItemRegistryImpl {
  private items = new Map<string, ItemDef>();
  private projectiles = new Map<string, ProjectileDef>();
  readonly problems: string[] = [];

  constructor() {
    for (const it of ALL_ITEMS) this.register(it);
    for (const p of PROJECTILES) this.projectiles.set(p.id, p);
    this.validate();
  }

  register(def: ItemDef): void {
    if (this.items.has(def.id)) this.problems.push(`duplicate item id "${def.id}"`);
    this.items.set(def.id, def);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** Always returns a def; unknown ids map to a safe placeholder. */
  get(id: string): ItemDef {
    return this.items.get(id) ?? UNKNOWN;
  }

  tryGet(id: string): ItemDef | undefined {
    return this.items.get(id);
  }

  all(): ItemDef[] {
    return [...this.items.values()];
  }

  projectile(id: string): ProjectileDef | undefined {
    return this.projectiles.get(id);
  }

  allProjectiles(): ProjectileDef[] {
    return [...this.projectiles.values()];
  }

  /** Cross-reference content so broken data is reported at startup rather than mid-game. */
  private validate(): void {
    for (const it of this.items.values()) {
      if (it.placeTile && TileRegistry.tryId(it.placeTile) === undefined) this.problems.push(`${it.id}: unknown placeTile ${it.placeTile}`);
      if (it.placeWall && TileRegistry.tryWallId(it.placeWall) === undefined) this.problems.push(`${it.id}: unknown placeWall ${it.placeWall}`);
      const proj = it.weapon?.projectile ?? it.weapon?.swingProjectile;
      if (proj && !this.projectiles.has(proj)) this.problems.push(`${it.id}: unknown projectile ${proj}`);
      if (it.ammo && !this.projectiles.has(it.ammo.projectile)) this.problems.push(`${it.id}: unknown ammo projectile`);
    }
    for (const t of TileRegistry.defs) {
      if (t && t.drop && !this.items.has(t.drop)) this.problems.push(`tile ${t.key}: unknown drop ${t.drop}`);
    }
    for (const p of this.projectiles.values()) {
      if (p.split && !this.projectiles.has(p.split.id)) this.problems.push(`projectile ${p.id}: unknown split ${p.split.id}`);
    }
    if (this.problems.length) console.warn('[ItemRegistry] content problems:\n' + this.problems.join('\n'));
  }
}

export const ItemRegistry = new ItemRegistryImpl();

export function buyPrice(def: ItemDef): number {
  return Math.max(1, Math.ceil(def.value * 5));
}

export function sellPrice(def: ItemDef, count = 1): number {
  return Math.floor(def.value * count);
}
