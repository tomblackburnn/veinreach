import type { GameContext } from '../../core/context';
import { NPCS, NPC_MAP, type NPCDef, type ShopEntry } from '../../data/npcs';
import { NPC } from './NPC';
import { checkRoom, comfortTier, COMFORT_TIERS, type RoomCheck, type ComfortTier } from '../../world/housing';
import { TileRegistry } from '../../world/TileRegistry';
import type { SavedNPC } from '../../world/WorldState';
import { ItemRegistry, buyPrice } from '../../items/ItemRegistry';

const CHECK_INTERVAL = 60 * 8;

/** What townsfolk say about their room, by comfort tier. */
const COMFORT_LINES: Partial<Record<ComfortTier['key'], string[]>> = {
  bare: ['Four walls and a chair. It’s a roof, I suppose.', 'Would it kill you to hang a picture in here?'],
  cozy: ['I do love what you’ve done with my room. I might even knock a little off my prices.', 'Honestly? Best room I’ve ever lived in.'],
  lavish: ['This place is a palace! For a landlord this generous, my best prices.', 'I wake up every morning and just stare at the decor. Wonderful.'],
};
const SCAN_RADIUS = 70;

/** Housing assignment, NPC arrival conditions, dialogue and shop inventories. */
export class NPCManager {
  private timer = 0;
  private chairId = TileRegistry.id('chair');

  get list(): NPC[] {
    return this.ctx ? this.ctx.entities.npcs : [];
  }

  private ctx: GameContext | null = null;

  bind(ctx: GameContext): void {
    this.ctx = ctx;
  }

  load(ctx: GameContext, saved: SavedNPC[]): void {
    for (const s of saved) {
      const def = NPC_MAP.get(s.defId);
      if (!def) continue;
      const n = new NPC(def, s.name, s.x, s.y);
      n.homeX = s.homeX;
      n.homeY = s.homeY;
      if (s.homeX !== null && s.homeY !== null) {
        const r = checkRoom(ctx.world, s.homeX, s.homeY);
        if (r.valid) {
          n.homeMinX = r.minX!;
          n.homeMaxX = r.maxX!;
        }
      }
      ctx.entities.add(n);
    }
  }

  serialize(): SavedNPC[] {
    return this.list.map((n) => ({ defId: n.def.id, name: n.name, x: n.cx, y: n.bottom, homeX: n.homeX, homeY: n.homeY }));
  }

  /** Find all valid rooms near a point, keyed by room id. */
  findRooms(ctx: GameContext, cx: number, cy: number): Map<number, RoomCheck> {
    const rooms = new Map<number, RoomCheck>();
    const w = ctx.world;
    for (let y = cy - SCAN_RADIUS; y <= cy + SCAN_RADIUS; y++) {
      for (let x = cx - SCAN_RADIUS; x <= cx + SCAN_RADIUS; x++) {
        if (w.getFg(x, y) !== this.chairId) continue;
        const r = checkRoom(w, x, y);
        if (r.valid && !rooms.has(r.key!)) rooms.set(r.key!, r);
      }
    }
    return rooms;
  }

  arrivalMet(ctx: GameContext, def: NPCDef): boolean {
    const p = ctx.player;
    switch (def.arrival) {
      case 'wallet':
        return p.inventory.wallet >= 50;
      case 'heart':
        return p.baseLife > 100;
      case 'brewer':
        return p.inventory.main.slots.some((s) => s && (s.id === 'glowshroom' || !!ItemRegistry.get(s.id).consumable?.buffs));
      case 'flag':
        return !!def.arrivalFlag && ctx.progression.has(def.arrivalFlag);
    }
  }

  update(ctx: GameContext): void {
    if (++this.timer < CHECK_INTERVAL) return;
    this.timer = 0;
    const rooms = this.findRooms(ctx, ctx.player.tileX, ctx.player.tileY);
    // Validate existing homes.
    for (const n of this.list) {
      if (n.homeX === null || n.homeY === null) continue;
      if (Math.abs(n.homeX - ctx.player.tileX) > SCAN_RADIUS || Math.abs(n.homeY - ctx.player.tileY) > SCAN_RADIUS) continue;
      const r = checkRoom(ctx.world, n.homeX, n.homeY);
      if (!r.valid) {
        ctx.message(`${n.displayName} no longer has a valid home: ${r.reason}`, '#ffb070');
        n.homeX = n.homeY = null;
      } else {
        rooms.delete(r.key!);
        n.homeMinX = r.minX!;
        n.homeMaxX = r.maxX!;
      }
    }
    const free = [...rooms.values()].filter((r) => !this.list.some((n) => n.homeX !== null && checkRoom(ctx.world, n.homeX, n.homeY!).key === r.key));
    // Homeless NPCs move into free rooms first.
    for (const n of this.list) {
      if (n.homeX !== null || !free.length) continue;
      const r = free.shift()!;
      this.assign(n, r);
      ctx.message(`${n.displayName} has moved into a new home.`, '#a0ffa0');
    }
    // New arrivals (daytime only, one at a time).
    if (!free.length || !ctx.time.isDay || ctx.worldEvents.active) return;
    for (const def of NPCS) {
      if (this.list.some((n) => n.def.id === def.id)) continue;
      if (!this.arrivalMet(ctx, def)) continue;
      const r = free.shift()!;
      const name = def.names[Math.floor(Math.random() * def.names.length)];
      const n = new NPC(def, name, r.standX! * 16 + 8, (r.standY! + 1) * 16);
      this.assign(n, r);
      ctx.entities.add(n);
      ctx.message(`${n.displayName} has arrived!`, '#80ffb0');
      ctx.audio.play('powerup', { volume: 0.6 });
      ctx.bus.emit('saveRequested', { reason: 'npc' });
      break;
    }
  }

  private assign(n: NPC, r: RoomCheck): void {
    n.homeX = r.standX!;
    n.homeY = r.standY!;
    n.homeMinX = r.minX!;
    n.homeMaxX = r.maxX!;
  }

  /** Pick a line of dialogue appropriate to the moment. */
  dialogue(ctx: GameContext, n: NPC): string {
    const d = n.def;
    const pool: string[] = [];
    if (ctx.worldEvents.active) pool.push(...d.eventLines);
    else if (ctx.time.isNight) pool.push(...d.nightLines, ...d.lines);
    else pool.push(...d.lines);
    for (const [flag, line] of Object.entries(d.flagLines ?? {})) if (ctx.progression.has(flag)) pool.push(line, line);
    const home = this.homeComfort(ctx, n);
    if (home && !ctx.worldEvents.active) pool.push(...(COMFORT_LINES[home.tier.key] ?? []));
    return pool[Math.floor(Math.random() * pool.length)] ?? '...';
  }

  /** Comfort of an NPC's home, or null if they have no valid home. */
  homeComfort(ctx: GameContext, n: NPC): { comfort: number; tier: ComfortTier } | null {
    if (n.homeX === null || n.homeY === null) return null;
    const r = checkRoom(ctx.world, n.homeX, n.homeY);
    return r.valid ? { comfort: r.comfort ?? 0, tier: comfortTier(r.comfort ?? 0) } : null;
  }

  /** Shop price multiplier: townsfolk in comfortable homes give discounts. */
  priceMultiplier(ctx: GameContext, n: NPC): number {
    return 1 - (this.homeComfort(ctx, n)?.tier.discount ?? 0);
  }

  shop(ctx: GameContext, n: NPC): { entry: ShopEntry; price: number }[] {
    const mult = this.priceMultiplier(ctx, n);
    return n.def.shop
      .filter((e) => ItemRegistry.has(e.item) && (!e.requires || ctx.progression.has(e.requires)))
      .map((e) => ({ entry: e, price: Math.max(1, Math.round((e.price ?? buyPrice(ItemRegistry.get(e.item))) * mult)) }));
  }

  healCost(ctx: GameContext): number {
    const p = ctx.player;
    const missing = p.maxLife - p.life;
    const mult = 1 + ctx.progression.bossesDefeated() * 0.5;
    return Math.ceil(missing * 0.6 * mult);
  }

  /** Housing query for the UI ("Check housing" button). */
  queryHousing(ctx: GameContext, tx: number, ty: number): string {
    const r = checkRoom(ctx.world, tx, ty);
    if (!r.valid) return r.reason ?? 'Not a valid room.';
    const owner = this.list.find((n) => n.homeX !== null && checkRoom(ctx.world, n.homeX, n.homeY!).key === r.key);
    const base = owner ? `This is ${owner.displayName}'s home.` : 'This room is suitable for a new resident!';
    return `${base} ${this.comfortSummary(r.comfort ?? 0)}`;
  }

  /** One-line comfort rating with what the next tier needs. */
  comfortSummary(comfort: number): string {
    const tier = comfortTier(comfort);
    const next = COMFORT_TIERS.find((t) => t.min > comfort);
    const perk = tier.discount ? ` Prices here are ${Math.round(tier.discount * 100)}% lower.` : '';
    const more = next ? ` ${next.min - comfort} more comfort for ${next.name}.` : '';
    return `Comfort ${comfort} (${tier.name}).${perk}${more}`;
  }

  hints(ctx: GameContext): string[] {
    return NPCS.filter((d) => !this.list.some((n) => n.def.id === d.id)).map((d) => `${d.role}: ${d.arrivalHint}${this.arrivalMet(ctx, d) ? ' (ready — needs a free house)' : ''}`);
  }
}
