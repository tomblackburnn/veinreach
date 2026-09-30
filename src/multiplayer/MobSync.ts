import type { GameContext } from '../core/context';
import type { ClientMsg, MobSnap, MobEvent, BossNet } from './protocol';
import { Enemy } from '../entities/enemies/Enemy';
import { Boss } from '../entities/bosses/Boss';
import { createBoss } from '../entities/bosses/BossManager';
import { ENEMY_MAP } from '../data/enemies';
import { BOSS_MAP } from '../data/bosses';
import { ItemRegistry } from '../items/ItemRegistry';
import type { HitInfo } from '../entities/Actor';
import type { Projectile } from '../entities/Projectile';
import { rollDamage } from '../combat/damage';

/** Snapshot rate (every N ticks ≈ 10 per second) and event flush rate. */
const SNAP_EVERY = 6;
const FLUSH_EVERY = 2;
/** Only creatures near another player are sent. */
const RANGE = 16 * 130;
/** Mirrors that stop receiving updates (owner left) are removed. */
const STALE_TICKS = 150;

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function randomTag(): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

/**
 * Shared creatures for multiplayer (Terraria-style shared combat without a
 * game server). Each creature is simulated by exactly one game, its owner:
 * whoever spawned it (or summoned the boss). Owners broadcast snapshots; the
 * other games show mirrors ("puppets") that interpolate, deal contact and
 * hazard damage to their own player, and forward hits to the owner, who
 * applies them. Deaths and loot are decided by the owner: normal loot goes
 * to the player who landed the killing blow, boss loot to everyone who took
 * part. Projectiles are mirrored too (players' shots are visual-only on other
 * screens; creatures' shots can hurt everyone).
 */
export class MobSync {
  readonly tag = randomTag();
  private counter = 0;
  private puppets = new Map<string, Enemy>();
  private events: MobEvent[] = [];
  private tickN = 0;
  private sentEmpty = true;
  /** Tag of the player whose hit is being applied right now (credited as the attacker). */
  applyingHitFrom: string | null = null;

  constructor(
    private ctx: GameContext,
    private send: (m: ClientMsg) => void,
  ) {}

  /** Call once per game tick. */
  tick(): void {
    this.tickN++;
    // Events first, so a death is announced before the snapshot that no longer lists the creature.
    if (this.tickN % FLUSH_EVERY === 0 && this.events.length) this.send({ t: 'ev', tag: this.tag, ev: this.events.splice(0) });
    if (this.tickN % SNAP_EVERY === 0) this.snapshot();
    for (const [n, p] of this.puppets) {
      const dying = p instanceof Boss && p.dying > 0;
      if (p.removed || (!dying && this.tickN - p.netSeen > STALE_TICKS)) {
        p.removed = true;
        this.puppets.delete(n);
      }
    }
  }

  /** Where a mirror of this network id lives, if any (for tests and UI). */
  puppet(n: string): Enemy | undefined {
    return this.puppets.get(n);
  }

  get puppetCount(): number {
    return this.puppets.size;
  }

  private nearRemote(x: number, y: number): boolean {
    return this.ctx.entities.remotes.some((r) => Math.abs(r.cx - x) < RANGE && Math.abs(r.cy - y) < RANGE);
  }

  private assignId(e: Enemy): string {
    e.netId ??= `${this.tag}.${(++this.counter).toString(36)}`;
    return e.netId;
  }

  // ---------------------------------------------------------------- owner side

  private snapshot(): void {
    const ctx = this.ctx;
    if (!ctx.entities.remotes.length) {
      if (!this.sentEmpty) this.send({ t: 'mobs', tag: this.tag, list: [] });
      this.sentEmpty = true;
      return;
    }
    const list: MobSnap[] = [];
    for (const e of ctx.entities.enemies) {
      // Worm bodies are rebuilt by each mirror from its head.
      if (e.puppet || e.head || e.removed) continue;
      const boss = e instanceof Boss ? e : null;
      if (e.dead && !(boss && boss.dying > 0)) continue;
      if (!boss && !this.nearRemote(e.cx, e.cy)) continue;
      list.push(this.snap(e, boss));
    }
    this.send({ t: 'mobs', tag: this.tag, list });
    this.sentEmpty = list.length === 0;
  }

  private snap(e: Enemy, boss: Boss | null): MobSnap {
    const s: MobSnap = {
      n: this.assignId(e),
      id: boss ? boss.bdef.id : e.def.id,
      x: r1(e.x),
      y: r1(e.y),
      vx: r2(e.vx),
      vy: r2(e.vy),
      f: e.facing,
      l: Math.ceil(e.life),
      ml: e.maxLife,
      s: e.state,
      dm: e.damage,
      df: e.defense,
    };
    if (e.onGround) s.g = 1;
    if (!e.hittable) s.h = 0;
    if (!e.harmful) s.hm = 0;
    if (boss) {
      s.boss = 1;
      s.bx = boss.netState();
    }
    return s;
  }

  /** An owned creature died: tell the others (they play the death and maybe roll loot). */
  enemyDied(e: Enemy): void {
    if (e.puppet || !e.netId) return;
    this.events.push({ k: 'die', n: e.netId, by: e.lastHitBy, boss: e instanceof Boss ? e.bdef.id : undefined, x: r1(e.cx), y: r1(e.cy) });
  }

  /** A projectile was spawned in this game: mirror it if it belongs to us. */
  projectileSpawned(p: Projectile): void {
    const ctx = this.ctx;
    if (p.o.ghost || p.o.fromNet || p.o.derived || !ctx.entities.remotes.length || !this.nearRemote(p.cx, p.cy)) return;
    const owner = p.o.owner;
    let ow: string;
    if (owner === ctx.player) ow = this.tag;
    else if (owner instanceof Enemy && !owner.puppet) ow = this.assignId(owner);
    else return;
    this.events.push({ k: 'proj', id: p.def.id, x: r1(p.cx), y: r1(p.cy), vx: r2(p.vx), vy: r2(p.vy), d: p.o.damage, kb: p.o.knockback, fr: p.friendly ? 1 : 0, sc: p.scale !== 1 ? p.scale : undefined, ow, ob: p.o.onHit });
  }

  // ---------------------------------------------------------------- hitting mirrors

  /**
   * The local player hit a mirrored creature. Show the hit immediately, lower
   * the mirror's health for responsiveness, and send the exact damage to the
   * owner, who applies it (so everyone agrees). Returns the damage dealt.
   */
  hitPuppet(e: Enemy, h: HitInfo, seg?: Enemy): number {
    const ctx = this.ctx;
    if (!e.netId || e.dead || !e.hittable) return 0;
    const roll = h.ignoreDefense ? { amount: Math.max(1, Math.round(h.damage)), crit: false } : rollDamage(h.damage, 0, h.critChance ?? 0, e.defense);
    const at = seg ?? e;
    if (!h.silent) ctx.text.damage(roll.amount, at.cx, at.y - 4, roll.crit, false);
    at.hitFlash = 8;
    e.puppetHurtFx(ctx);
    e.life = Math.max(1, e.life - roll.amount);
    e.localDamage += roll.amount;
    e.lastLocalHit = this.tickN;
    const buff = h.buff && Math.random() < h.buff.chance ? h.buff : null;
    this.events.push({ k: 'hit', n: e.netId, d: roll.amount, kb: r2(h.knockback), dx: h.dirX, c: roll.crit ? 1 : undefined, b: buff?.buff, bs: buff?.seconds });
    return roll.amount;
  }

  // ---------------------------------------------------------------- receiving

  receive(m: Extract<ClientMsg, { t: 'mobs' } | { t: 'ev' }>): void {
    if (m.tag === this.tag) return;
    if (m.t === 'mobs') this.onMobs(m.tag, m.list);
    else for (const ev of m.ev) this.onEvent(m.tag, ev);
  }

  private onMobs(tag: string, list: MobSnap[]): void {
    const seen = new Set<string>();
    for (const s of Array.isArray(list) ? list.slice(0, 200) : []) {
      if (typeof s?.n !== 'string' || !s.n.startsWith(`${tag}.`) || ![s.x, s.y, s.vx, s.vy, s.l, s.ml].every((v) => typeof v === 'number' && isFinite(v))) continue;
      seen.add(s.n);
      let p = this.puppets.get(s.n);
      if (!p) {
        const made = this.create(s);
        if (!made) continue;
        p = made;
      }
      this.apply(p, s);
    }
    // Anything this owner stopped sending has despawned. Deaths arrive as events, which can
    // travel separately from snapshots, so wait a few snapshots before removing a mirror.
    for (const [n, p] of this.puppets) {
      if (!n.startsWith(`${tag}.`)) continue;
      if (seen.has(n)) p.netMissing = 0;
      else if (!(p instanceof Boss && p.dying > 0) && ++p.netMissing >= 3) {
        p.removed = true;
        this.puppets.delete(n);
      }
    }
  }

  private create(s: MobSnap): Enemy | null {
    const ctx = this.ctx;
    let p: Enemy;
    if (s.boss) {
      const def = BOSS_MAP.get(s.id);
      if (!def) return null;
      const b = createBoss(s.id, s.x + def.w / 2, s.y + def.h / 2);
      if (!b) return null;
      p = b;
      if (!(s.bx && s.bx.dy > 0)) {
        ctx.ui.bossIntro(def.name, def.title);
        ctx.audio.play('bossRoar');
        ctx.message(`${def.name} has awoken!`, '#ff6a8a');
      }
    } else {
      const def = ENEMY_MAP.get(s.id);
      if (!def) return null;
      p = new Enemy(def, 0, 0);
    }
    p.puppet = true;
    p.netId = s.n;
    p.despawnable = false;
    p.x = p.netX = s.x;
    p.y = p.netY = s.y;
    ctx.entities.add(p);
    this.puppets.set(s.n, p);
    return p;
  }

  private apply(p: Enemy, s: MobSnap): void {
    p.netX = s.x;
    p.netY = s.y;
    p.vx = s.vx;
    p.vy = s.vy;
    p.facing = s.f === -1 ? -1 : 1;
    p.maxLife = Math.max(1, s.ml);
    // Right after our own hits, keep the predicted (lower) health until the owner's catches up.
    p.life = this.tickN - p.lastLocalHit < SNAP_EVERY * 3 ? Math.min(p.life, s.l) : s.l;
    if (typeof s.s === 'string') p.setState(s.s.slice(0, 24));
    p.onGround = s.g === 1;
    p.hittable = s.h !== 0;
    p.harmful = s.hm !== 0;
    if (typeof s.dm === 'number') p.damage = s.dm;
    if (typeof s.df === 'number') p.defense = s.df;
    p.netSeen = this.tickN;
    if (p instanceof Boss && s.bx) p.applyNetState(s.bx as BossNet);
  }

  private onEvent(tag: string, ev: MobEvent): void {
    const ctx = this.ctx;
    switch (ev?.k) {
      case 'hit': {
        if (typeof ev.n !== 'string' || !ev.n.startsWith(`${this.tag}.`) || typeof ev.d !== 'number' || !(ev.d > 0)) return;
        const e = ctx.entities.enemies.find((x) => x.netId === ev.n && !x.puppet);
        if (!e || e.dead || e.removed) return;
        this.applyingHitFrom = tag;
        try {
          e.hurt(ctx, {
            damage: Math.min(ev.d, 100000),
            ignoreDefense: true,
            knockback: typeof ev.kb === 'number' ? Math.min(ev.kb, 30) : 0,
            dirX: ev.dx === -1 ? -1 : 1,
            buff: typeof ev.b === 'string' ? { buff: ev.b, seconds: Math.min(ev.bs ?? 3, 60), chance: 1 } : undefined,
          });
        } finally {
          this.applyingHitFrom = null;
        }
        return;
      }
      case 'die': {
        const p = typeof ev.n === 'string' ? this.puppets.get(ev.n) : undefined;
        if (!p) return;
        if (p instanceof Boss) p.startPuppetDeath(ctx);
        else {
          p.puppetDie(ctx, ev.by === this.tag);
          this.puppets.delete(ev.n);
        }
        return;
      }
      case 'proj': {
        const def = typeof ev.id === 'string' ? ItemRegistry.projectile(ev.id) : undefined;
        if (!def || ![ev.x, ev.y, ev.vx, ev.vy].every((v) => typeof v === 'number' && isFinite(v))) return;
        const scale = typeof ev.sc === 'number' ? Math.min(Math.max(ev.sc, 0.2), 5) : undefined;
        if (ev.fr) {
          // Another player's shot: visible here, but only their game deals its damage.
          const owner = ctx.entities.remotes.reduce<(typeof ctx.entities.remotes)[number] | null>((best, r) => (!best || Math.hypot(r.cx - ev.x, r.cy - ev.y) < Math.hypot(best.cx - ev.x, best.cy - ev.y) ? r : best), null);
          ctx.spawnProjectile(ev.id, ev.x, ev.y, ev.vx, ev.vy, { damage: 0, knockback: 0, friendly: true, ghost: true, fromNet: true, owner, scale });
        } else {
          const owner = typeof ev.ow === 'string' ? this.puppets.get(ev.ow) ?? null : null;
          ctx.spawnProjectile(ev.id, ev.x, ev.y, ev.vx, ev.vy, { damage: Math.min(Math.max(0, ev.d), 5000), knockback: Math.min(ev.kb, 30), friendly: false, fromNet: true, owner, onHit: ev.ob, scale });
        }
        return;
      }
    }
  }
}
