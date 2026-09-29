import type { GameContext } from '../core/context';
import { ENEMIES, type EnemyDef, type SpawnRule } from '../data/enemies';
import { detectBiome } from '../biomes/BiomeDetector';
import type { BiomeKey } from '../data/biomes';
import { TileRegistry } from '../world/TileRegistry';
import { rectHitsSolid } from '../physics/Physics';

const MIN_DIST = 36; // tiles
const MAX_DIST = 64;

/**
 * Natural enemy spawning with biome/depth/time/progression/event rules,
 * spawn caps, minimum distance from the player (always off-screen), terrain
 * validation and safe zones inside player-built houses.
 */
export class SpawnSystem {
  private timer = 0;
  enabled = true;
  rateMul = 1;

  cap(ctx: GameContext, zone: string): number {
    let cap = zone === 'surface' ? (ctx.time.isNight ? 7 : 4) : zone === 'sky' ? 3 : 8;
    if (ctx.worldEvents.active) cap = ctx.worldEvents.active.id === 'raid' ? 14 : 12;
    if (ctx.weather.kind === 'storm' || ctx.weather.kind === 'veilstorm') cap += 2;
    if (ctx.bosses.active.length) cap = Math.floor(cap / 2);
    return cap;
  }

  update(ctx: GameContext): void {
    if (!this.enabled || ctx.player.dead) return;
    if (++this.timer < 25) return;
    this.timer = 0;
    const p = ctx.player;
    const zone = ctx.world.zoneAt(p.tileY);
    const near = ctx.entities.enemies.filter((e) => !e.isBoss && !e.head && Math.abs(e.cx - p.cx) < 16 * 90 && Math.abs(e.cy - p.cy) < 16 * 60).length;
    if (near >= this.cap(ctx, zone)) return;
    const chance = (zone === 'surface' && ctx.time.isDay ? 0.25 : 0.45) * this.rateMul * (ctx.worldEvents.active ? 2 : 1);
    if (Math.random() > chance) return;
    this.trySpawn(ctx);
  }

  private matches(ctx: GameContext, r: SpawnRule, biome: BiomeKey, zone: string, eventId: string | null): boolean {
    if (r.event) return r.event === eventId;
    if (r.requires && !ctx.progression.has(r.requires)) return false;
    if (r.excludes && ctx.progression.has(r.excludes)) return false;
    if (r.biomes && !r.biomes.includes(biome)) return false;
    if (r.zones && !r.zones.includes(zone as never)) return false;
    if (r.time === 'day' && ctx.time.isNight) return false;
    if (r.time === 'night' && ctx.time.isDay) return false;
    return true;
  }

  candidates(ctx: GameContext, biome: BiomeKey, zone: string): { def: EnemyDef; weight: number }[] {
    const ev = ctx.worldEvents.active?.id ?? null;
    const out: { def: EnemyDef; weight: number }[] = [];
    for (const def of ENEMIES) {
      let w = 0;
      for (const r of def.spawn) {
        if (!this.matches(ctx, r, biome, zone, ev)) continue;
        // Surface events dominate surface spawns.
        const eventRule = !!r.event;
        const scale = ev && zone === 'surface' && ev !== 'starfall' ? (eventRule ? 4 : 0.35) : 1;
        w += r.weight * scale;
      }
      if (w > 0) out.push({ def, weight: w });
    }
    return out;
  }

  trySpawn(ctx: GameContext): boolean {
    const p = ctx.player;
    const w = ctx.world;
    const cam = ctx.camera;
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const tx = p.tileX + side * (MIN_DIST + Math.floor(Math.random() * (MAX_DIST - MIN_DIST)));
      let ty = p.tileY + Math.floor(Math.random() * 50) - 25;
      if (tx < 5 || tx >= w.width - 5 || ty < 5 || ty >= w.height - 5) continue;
      // Never spawn visibly on screen.
      if (tx * 16 > cam.left - 64 && tx * 16 < cam.right + 64 && ty * 16 > cam.top - 64 && ty * 16 < cam.bottom + 64) continue;
      const zone = w.zoneAt(ty);
      const biome = detectBiome(w, tx, ty);
      const cands = this.candidates(ctx, biome, zone);
      if (!cands.length) continue;
      let total = 0;
      for (const c of cands) total += c.weight;
      let r = Math.random() * total;
      let def = cands[0].def;
      for (const c of cands) {
        r -= c.weight;
        if (r <= 0) {
          def = c.def;
          break;
        }
      }
      const flying = !!def.flying || def.ai === 'worm' || def.ai === 'ghost';
      if (!flying) {
        // Drop to the floor.
        let steps = 0;
        while (ty < w.height - 2 && !w.isSolid(tx, ty + 1) && steps++ < 30) ty++;
        if (!w.isSolid(tx, ty + 1)) continue;
      }
      if (def.ai === 'worm') {
        if (!w.isSolid(tx, ty)) continue;
      } else {
        const px = tx * 16 + 8 - def.w / 2;
        const py = (ty + 1) * 16 - def.h;
        if (rectHitsSolid(w, px, py, def.w, def.h)) continue;
        if (w.getLiquid(tx, ty) > 100 && def.id !== 'magma_gloop') continue;
      }
      // Houses are safe zones.
      const wall = w.getWall(tx, ty);
      if (wall && !TileRegistry.wall(wall).natural) continue;
      const e = ctx.spawnEnemy(def.id, tx * 16 + 8, (ty + 1) * 16);
      if (e) return true;
    }
    return false;
  }
}
