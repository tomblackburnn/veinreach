import { BUFF_MAP, type BuffDef } from '../data/buffs';
import { addMods, type ResolvedStats } from '../items/stats';

/** Active buffs/debuffs on an actor, with remaining duration in ticks. */
export class BuffSet {
  readonly active = new Map<string, number>();
  version = 0;

  add(id: string, ticks: number): void {
    if (!BUFF_MAP.has(id)) return;
    const cur = this.active.get(id) ?? 0;
    if (ticks > cur) {
      this.active.set(id, ticks);
      this.version++;
    }
  }

  has(id: string): boolean {
    return this.active.has(id);
  }

  remove(id: string): void {
    if (this.active.delete(id)) this.version++;
  }

  clear(): void {
    this.active.clear();
    this.version++;
  }

  /** Advance one tick. Returns damage-over-time to apply this tick. */
  tick(immune: (def: BuffDef) => boolean): number {
    let dot = 0;
    for (const [id, t] of this.active) {
      const def = BUFF_MAP.get(id)!;
      if (immune(def)) {
        this.active.delete(id);
        this.version++;
        continue;
      }
      if (def.dps) dot += def.dps / 60;
      if (t <= 1) {
        this.active.delete(id);
        this.version++;
      } else this.active.set(id, t - 1);
    }
    return dot;
  }

  applyMods(stats: ResolvedStats): void {
    for (const id of this.active.keys()) addMods(stats, BUFF_MAP.get(id)?.mods);
  }

  speedMul(): number {
    let m = 1;
    for (const id of this.active.keys()) m *= BUFF_MAP.get(id)?.speedMul ?? 1;
    return m;
  }

  list(): { def: BuffDef; ticks: number }[] {
    return [...this.active].map(([id, ticks]) => ({ def: BUFF_MAP.get(id)!, ticks }));
  }

  serialize(): Record<string, number> {
    return Object.fromEntries(this.active);
  }

  load(d: unknown): void {
    this.active.clear();
    if (d && typeof d === 'object') {
      for (const [k, v] of Object.entries(d as Record<string, unknown>)) if (BUFF_MAP.has(k) && typeof v === 'number') this.active.set(k, v);
    }
    this.version++;
  }
}
