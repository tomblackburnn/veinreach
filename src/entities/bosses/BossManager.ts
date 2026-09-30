import type { GameContext } from '../../core/context';
import type { Player } from '../player/Player';
import { Boss } from './Boss';
import { Gravelmaw } from './Gravelmaw';
import { Thornwarden } from './Thornwarden';
import { ObeliskPrime } from './ObeliskPrime';
import { Serpent } from './Serpent';
import { Solmara } from './Solmara';
import { BOSS_MAP } from '../../data/bosses';
import { detectBiome } from '../../biomes/BiomeDetector';
import { FLAGS } from '../../systems/ProgressionSystem';

type Factory = (x: number, y: number) => Boss;

const FACTORIES: Record<string, Factory> = {
  gravelmaw: (x, y) => new Gravelmaw(x, y),
  thornwarden: (x, y) => new Thornwarden(x, y),
  obelisk: (x, y) => new ObeliskPrime(x, y),
  serpent: (x, y) => new Serpent(x, y),
  solmara: (x, y) => new Solmara(x, y),
};

const UNLOCK_TEXT: Record<string, string> = {
  gravelmaw: 'Gravelmaw Chitin can now be forged at an anvil. New wares may appear in shops.',
  thornwarden: 'The blight recedes. Heartwood of the Warden can be crafted into gear.',
  obelisk: 'THE SEAL IS BROKEN. The world is changing...',
  serpent: 'The Emberwyrm is slain. The Starloom can now be built — and something stirs in the night sky.',
  solmara: 'The Unmade Star is extinguished. Veinreach is at peace — for now.',
};

/** Build a boss by id (used for mirrors of another player's boss in multiplayer). */
export function createBoss(id: string, x: number, y: number): Boss | null {
  const f = FACTORIES[id];
  return f ? f(x, y) : null;
}

/** Summoning rules, active boss tracking, boss music and defeat handling. */
export class BossManager {
  get active(): Boss[] {
    return this.ctxRef ? (this.ctxRef.entities.enemies.filter((e) => e instanceof Boss && !e.removed) as Boss[]) : [];
  }
  private ctxRef: GameContext | null = null;

  bind(ctx: GameContext): void {
    this.ctxRef = ctx;
  }

  get primary(): Boss | null {
    return this.active[0] ?? null;
  }

  musicOverride(): string | null {
    const b = this.primary;
    return b && b.dying <= 0 ? b.bdef.music : null;
  }

  /** Validate summoning conditions; spawn on success. Returns an error message or null. */
  trySummon(id: string, p: Player): string | null {
    const ctx = this.ctxRef;
    if (!ctx) return 'Not ready.';
    const def = BOSS_MAP.get(id);
    if (!def) return 'Nothing happens.';
    if (this.active.length) return 'A great foe is already present.';
    const zone = ctx.world.zoneAt(p.tileY);
    const biome = detectBiome(ctx.world, p.tileX, p.tileY);
    switch (id) {
      case 'gravelmaw':
        if (zone === 'surface' || zone === 'sky') return 'The lure must be used underground.';
        break;
      case 'thornwarden':
        if (zone !== 'surface' || !ctx.time.isNight) return 'The seed will only take root on the surface at night.';
        break;
      case 'obelisk':
        if (zone !== 'deep' && biome !== 'glimmer') return 'The prism only resonates deep beneath the world.';
        break;
      case 'serpent':
        if (!ctx.progression.has(FLAGS.unsealed)) return 'The chalice stays cold. The Seal still holds.';
        if (zone !== 'underworld') return 'The chalice must be offered in Emberdeep.';
        break;
      case 'solmara':
        if (!ctx.progression.has(FLAGS.serpent)) return 'The sigil is silent.';
        if (zone !== 'surface' || !ctx.time.isNight) return 'Raise the sigil to the open night sky.';
        break;
    }
    this.spawn(ctx, id, p);
    return null;
  }

  spawn(ctx: GameContext, id: string, p: Player): Boss | null {
    const def = BOSS_MAP.get(id);
    const f = FACTORIES[id];
    if (!def || !f) return null;
    let x = p.cx;
    let y = p.cy;
    switch (id) {
      case 'gravelmaw':
        y = p.bottom + 180;
        break;
      case 'thornwarden':
        x = p.cx + 120;
        y = p.bottom + 40;
        break;
      case 'obelisk':
        x = p.cx + 260;
        y = p.cy + 200;
        break;
      case 'serpent':
        y = p.cy + 800;
        break;
      case 'solmara':
        y = p.cy - 520;
        break;
    }
    const boss = f(x, y);
    ctx.entities.add(boss);
    ctx.ui.bossIntro(def.name, def.title);
    ctx.audio.play('bossRoar');
    ctx.shake(0.6);
    ctx.bus.emit('bossSpawned', { id, name: def.name, title: def.title });
    ctx.message(`${def.name} has awoken!`, '#ff6a8a');
    return boss;
  }

  onDefeated(ctx: GameContext, boss: Boss): void {
    const first = ctx.progression.recordBossKill(boss.bdef.id);
    ctx.bus.emit('bossDefeated', { id: boss.bdef.id, name: boss.bdef.name });
    ctx.ui.banner(`${boss.bdef.name} has been defeated!`, first ? UNLOCK_TEXT[boss.bdef.id] : undefined, '#ffe16b');
    ctx.message(`${boss.bdef.name} has been defeated!`, '#ffe16b');
    if (first && UNLOCK_TEXT[boss.bdef.id]) ctx.message(UNLOCK_TEXT[boss.bdef.id], '#c0ffc0');
    // Obelisk Prime's first defeat breaks the Seal.
    if (boss.bdef.id === 'obelisk') ctx.progression.set(FLAGS.unsealed);
    ctx.bus.emit('saveRequested', { reason: 'boss' });
  }
}
