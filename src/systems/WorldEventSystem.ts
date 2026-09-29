import type { GameContext } from '../core/context';
import type { ActiveEvent } from '../world/WorldState';
import type { Enemy } from '../entities/enemies/Enemy';
import { FLAGS } from './ProgressionSystem';
import { TileRegistry, T } from '../world/TileRegistry';

export interface WorldEventDef {
  id: string;
  name: string;
  description: string;
  music: string;
  skyTint?: string;
  night?: boolean;
  goal?: (ctx: GameContext) => number;
}

export const WORLD_EVENTS: Record<string, WorldEventDef> = {
  gloamtide: { id: 'gloamtide', name: 'Gloamtide', description: 'A violet moon rises. The dead walk in greater numbers.', music: 'event', skyTint: '#5a1a7a', night: true },
  raid: { id: 'raid', name: 'Rustbound Raid', description: 'Scrapjack raiders are assaulting the land!', music: 'event', goal: (ctx) => 40 + ctx.progression.bossesDefeated() * 10 },
  starfall: { id: 'starfall', name: 'Starfall', description: 'Stars are falling from the sky tonight.', music: 'night', night: true },
  veilstorm: { id: 'veilstorm', name: 'Veilstorm', description: 'The veil between worlds thins. Voidwraiths hunt in the storm.', music: 'event', skyTint: '#2a0a4a' },
};

/**
 * Timed world events: triggered randomly at dusk/dawn or by items. Tracks
 * invasion progress, grants progression flags on success.
 */
export class WorldEventSystem {
  active: ActiveEvent | null = null;
  private starTimer = 0;

  get def(): WorldEventDef | null {
    return this.active ? WORLD_EVENTS[this.active.id] ?? null : null;
  }

  tryStart(id: string, byItem = false): string | null {
    if (this.active) return 'Another event is already underway.';
    const def = WORLD_EVENTS[id];
    if (!def) return 'Nothing happens.';
    if (def.night && byItem && !this.ctx?.time.isNight) return 'This can only be used at night.';
    this.start(id);
    return null;
  }

  private ctx: GameContext | null = null;
  bind(ctx: GameContext): void {
    this.ctx = ctx;
  }

  start(id: string): void {
    const ctx = this.ctx;
    const def = WORLD_EVENTS[id];
    if (!ctx || !def) return;
    this.active = { id, progress: 0, goal: def.goal ? def.goal(ctx) : 0, ticks: 0 };
    ctx.ui.banner(def.name, def.description, def.skyTint ? '#e0a0ff' : '#ffb070');
    ctx.message(def.description, '#e0a0ff');
    ctx.audio.play('eventStart');
    if (id === 'veilstorm') ctx.weather.set('veilstorm', 60 * 60 * 4);
  }

  end(success: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.active) return;
    const def = WORLD_EVENTS[this.active.id];
    if (success) {
      ctx.message(`The ${def.name} has ended. Victory!`, '#a0ffa0');
      if (this.active.id === 'raid') ctx.progression.set(FLAGS.raidDefeated);
      if (this.active.id === 'gloamtide') ctx.progression.set(FLAGS.gloamtideSurvived);
    } else ctx.message(`The ${def.name} has passed.`, '#c0c0c0');
    this.active = null;
    ctx.bus.emit('saveRequested', { reason: 'event' });
  }

  onEnemyKilled(e: Enemy): void {
    if (this.active?.id === 'raid' && e.def.spawn.some((r) => r.event === 'raid')) {
      this.active.progress++;
      if (this.active.progress >= this.active.goal) this.end(true);
    }
  }

  update(ctx: GameContext, hourChanged: { dusk: boolean; dawn: boolean }): void {
    const a = this.active;
    if (a) {
      a.ticks++;
      const def = WORLD_EVENTS[a.id];
      if (def.night && hourChanged.dawn) this.end(true);
      if (a.id === 'raid' && a.ticks > 60 * 60 * 6) this.end(false);
      if (a.id === 'veilstorm' && ctx.weather.kind !== 'veilstorm') this.end(true);
      if (a.id === 'starfall') this.updateStarfall(ctx);
      return;
    }
    const tier = ctx.progression.bossesDefeated();
    if (hourChanged.dusk && ctx.time.day > 1) {
      const r = Math.random();
      if (ctx.progression.has(FLAGS.unsealed) && r < 0.08) this.start('veilstorm');
      else if (tier >= 1 && r < 0.18) this.start('gloamtide');
      else if (r < 0.32) this.start('starfall');
    }
    if (hourChanged.dawn && ctx.progression.has(FLAGS.gravelmaw) && !ctx.progression.has(FLAGS.raidDefeated) && Math.random() < 0.12) this.start('raid');
  }

  /** Meteors streak down; one crashes and leaves Starshard ore. */
  private updateStarfall(ctx: GameContext): void {
    if (++this.starTimer % 30 === 0) {
      const x = ctx.camera.left + Math.random() * (ctx.camera.right - ctx.camera.left);
      ctx.spawnProjectile('starfall', x, ctx.camera.top - 50, -2 + Math.random() * 4, 8, { damage: 0, knockback: 0, friendly: true, lifeMul: 0.6 });
    }
    if (this.starTimer === 60 * 20) this.crashStar(ctx);
  }

  crashStar(ctx: GameContext): void {
    const w = ctx.world;
    const spawn = Math.floor(w.width / 2);
    let x = 0;
    for (let i = 0; i < 20; i++) {
      x = 80 + Math.floor(Math.random() * (w.width - 160));
      if (Math.abs(x - spawn) > 80) break;
    }
    let y = 0;
    while (y < w.height - 1 && !w.isSolid(x, y)) y++;
    const ore = TileRegistry.id('starshard_ore');
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const d = Math.hypot(dx, dy * 1.3);
        if (d < 6) w.setFg(x + dx, y + dy, 0, 0);
        else if (d < 8.5 && w.getFg(x + dx, y + dy) !== 0 && w.getFg(x + dx, y + dy) !== T.chest) w.setFg(x + dx, y + dy, ore, 0);
      }
    }
    for (let dx = -4; dx <= 4; dx++) w.setFg(x + dx, y + 6, ore, 0);
    const dir = x < ctx.player.tileX ? 'west' : 'east';
    ctx.message(`A star has crashed to the ${dir}! (${Math.abs(x - ctx.player.tileX)} tiles away)`, '#ff8ae6');
    ctx.audio.play('explosion', { volume: 0.8, pitch: 0.5 });
    ctx.shake(0.4);
  }
}
