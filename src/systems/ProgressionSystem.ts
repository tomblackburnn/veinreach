import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/context';

/** Progression flags used across content (recipes, loot, spawns, NPCs). */
export const FLAGS = {
  gravelmaw: 'boss:gravelmaw',
  thornwarden: 'boss:thornwarden',
  obelisk: 'boss:obelisk',
  serpent: 'boss:serpent',
  solmara: 'boss:solmara',
  unsealed: 'unsealed',
  raidDefeated: 'event:raid',
  gloamtideSurvived: 'event:gloamtide',
} as const;

export const BOSS_ORDER = ['gravelmaw', 'thornwarden', 'obelisk', 'serpent', 'solmara'] as const;

/** World progression state: flags and boss kill counts. */
export class ProgressionSystem {
  readonly flags = new Set<string>();
  readonly bossKills: Record<string, number> = {};

  constructor(private bus: EventBus<GameEvents>) {}

  has(flag: string): boolean {
    return this.flags.has(flag);
  }

  set(flag: string): boolean {
    if (this.flags.has(flag)) return false;
    this.flags.add(flag);
    this.bus.emit('flagSet', { flag });
    return true;
  }

  recordBossKill(id: string): boolean {
    this.bossKills[id] = (this.bossKills[id] ?? 0) + 1;
    return this.set(`boss:${id}`);
  }

  bossesDefeated(): number {
    return BOSS_ORDER.filter((b) => this.flags.has(`boss:${b}`)).length;
  }

  /** Coarse difficulty tier used by spawn scaling (0..5). */
  tier(): number {
    return this.bossesDefeated();
  }

  load(flags: string[], kills: Record<string, number>): void {
    this.flags.clear();
    for (const f of flags) if (typeof f === 'string') this.flags.add(f);
    for (const [k, v] of Object.entries(kills ?? {})) if (typeof v === 'number') this.bossKills[k] = v;
  }
}
