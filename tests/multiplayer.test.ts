import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { MobSync } from '../src/multiplayer/MobSync';
import { RemotePlayer } from '../src/multiplayer/RemotePlayer';
import { sanitizeAppearance } from '../src/entities/player/Appearance';
import { Enemy } from '../src/entities/enemies/Enemy';
import { Boss } from '../src/entities/bosses/Boss';
import type { ClientMsg } from '../src/multiplayer/protocol';

/**
 * Two complete games (Alice = A, Bob = B) connected through an in-memory
 * relay that JSON-round-trips every message, exactly like the network.
 */
function pair(seed: string) {
  const opts = { name: 'mp', seed, width: 420, height: 260 };
  const gA = generateWorldSync(opts);
  const gB = generateWorldSync(opts);
  const A = new SimContext(gA.world);
  const B = new SimContext(gB.world);
  const toA: ClientMsg[] = [];
  const toB: ClientMsg[] = [];
  A.mp = new MobSync(A, (m) => toB.push(JSON.parse(JSON.stringify(m))));
  B.mp = new MobSync(B, (m) => toA.push(JSON.parse(JSON.stringify(m))));
  // Each game shows the other player as a remote avatar.
  const bobInA = new RemotePlayer(2, 'Bob', sanitizeAppearance({}), 0, 0);
  const aliceInB = new RemotePlayer(1, 'Alice', sanitizeAppearance({}), 0, 0);
  A.entities.add(bobInA);
  B.entities.add(aliceInB);
  const mirror = (av: RemotePlayer, from: SimContext) =>
    av.applyState({ x: from.player.x, y: from.player.y, vx: 0, vy: 0, facing: 1, anim: from.player.dead ? 'dead' : 'idle', held: null, armor: [], life: from.player.life, maxLife: from.player.maxLife });
  const deliver = (q: ClientMsg[], to: SimContext) => {
    for (const m of q.splice(0)) if (m.t === 'mobs' || m.t === 'ev') to.mp!.receive(m);
  };
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      mirror(bobInA, B);
      mirror(aliceInB, A);
      A.step(1);
      B.step(1);
      deliver(toA, A);
      deliver(toB, B);
    }
  };
  const spawn = { x: gA.spawnX, y: gA.spawnY };
  // Night, so night-only bosses don't leave.
  A.time.setHour(22);
  B.time.setHour(22);
  A.player.teleportTo(A, spawn.x, spawn.y);
  B.player.teleportTo(B, spawn.x + 3, spawn.y);
  return { A, B, step, bobInA, aliceInB, spawn };
}

const puppetsIn = (c: SimContext) => c.entities.enemies.filter((e) => e.puppet);

afterEach(() => vi.restoreAllMocks());

describe('shared multiplayer combat', () => {
  it('a boss fought by two players: shared health, damage from both, shared kill and loot for both', () => {
    const { A, B, step } = pair('mp-boss');
    A.god = true;
    const boss = A.bosses.spawn(A, 'thornwarden', A.player)!;
    expect(boss).toBeTruthy();
    step(12);
    const mirror = puppetsIn(B).find((e) => e instanceof Boss) as Boss | undefined;
    expect(mirror, 'Bob sees the boss').toBeTruthy();
    expect(mirror!.bdef.id).toBe('thornwarden');
    expect(B.bosses.active.length).toBe(1); // boss bar + "already present" rules work for Bob too
    // Wait out the intro shield.
    for (let i = 0; i < 600 && (boss.shielded > 0 || mirror!.shielded > 0); i++) step(1);
    expect(mirror!.life).toBe(boss.life);

    // Bob hits the mirror: shown immediately, applied by Alice's game.
    const before = boss.life;
    const dealt = mirror!.hurt(B, { damage: 60, knockback: 0, dirX: 1 });
    expect(dealt).toBeGreaterThan(0);
    step(4);
    expect(boss.life).toBe(before - dealt);
    // Alice hits her boss: Bob's health bar follows.
    const dealtA = boss.hurt(A, { damage: 40, knockback: 0, dirX: 1 });
    step(8);
    expect(mirror!.life).toBe(boss.life);
    expect(dealtA).toBeGreaterThan(0);

    // The mirror's body hurts Bob when he touches it.
    B.player.immune = 0;
    const hpBefore = B.player.life;
    B.player.setCenter(mirror!.cx, mirror!.cy);
    step(3);
    expect(B.player.life).toBeLessThan(hpBefore);
    B.god = true;

    // Bob lands the killing blow.
    const loot = vi.spyOn(Boss.prototype, 'dropLoot');
    for (let i = 0; i < 200 && !boss.dead; i++) {
      mirror!.hurt(B, { damage: 5000, knockback: 0, dirX: 1 });
      step(2);
    }
    expect(boss.dead).toBe(true);
    expect(boss.lastHitBy).toBe(B.mp!.tag);
    step(3);
    expect(mirror!.dying).toBeGreaterThan(0); // Bob sees the death sequence too
    step(200);
    expect(A.progression.has('boss:thornwarden')).toBe(true);
    expect(B.progression.has('boss:thornwarden')).toBe(true);
    // Both players got their own boss loot.
    const who = loot.mock.contexts as unknown as Boss[];
    expect(who).toContain(boss);
    expect(who).toContain(mirror);
    expect(B.messages.some((m) => /defeated/i.test(m))).toBe(true);
  });

  it('normal creatures: shared, chase the nearest player, and the killer gets the loot', () => {
    const { A, B, step, bobInA } = pair('mp-mobs');
    A.god = true;
    B.god = true;
    // Alice walks away; Bob stays next to a creature from Alice's game.
    A.player.teleportTo(A, Math.floor(A.player.cx / 16) + 70, Math.floor(A.player.cy / 16) - 4);
    step(2);
    const e = A.spawnEnemy('gloop', B.player.cx + 40, B.player.bottom - 2)!;
    step(12);
    expect(e.target, 'it chases the nearer player (Bob)').toBe(bobInA);
    const m = puppetsIn(B).find((p) => p.netId === e.netId);
    expect(m, 'Bob sees it').toBeTruthy();
    expect(Math.abs(m!.cx - e.cx)).toBeLessThan(24);

    const loot = vi.spyOn(Enemy.prototype, 'dropLoot');
    const dealt = m!.hurt(B, { damage: 9999, knockback: 0, dirX: 1 });
    expect(dealt).toBeGreaterThan(0);
    step(6);
    expect(e.dead).toBe(true);
    expect(m!.removed).toBe(true);
    const who = loot.mock.contexts as unknown as Enemy[];
    expect(who).toContain(m); // Bob (the killer) rolls the loot in his game…
    expect(who).not.toContain(e); // …Alice doesn't.
  });

  it('projectiles: players see each other’s shots; creature shots can hit everyone', () => {
    const { A, B, step } = pair('mp-proj');
    A.god = true;
    B.player.immune = 0;
    step(2);
    B.spawnProjectile('arrow_wood', B.player.cx, B.player.cy, 6, -1, { damage: 12, knockback: 2, friendly: true, owner: B.player });
    step(4);
    const ghost = A.entities.projectiles.find((p) => p.o.ghost);
    expect(ghost, 'Alice sees Bob’s arrow').toBeTruthy();
    expect(ghost!.friendly).toBe(true);

    const e = A.spawnEnemy('gloop', A.player.cx + 30, A.player.bottom - 2)!;
    step(8);
    e.removed = true; // out of the way: only the shot should touch Bob
    step(8);
    B.player.immune = 0;
    B.player.vx = 0;
    const hpBefore = B.player.life;
    A.spawnProjectile('arrow_wood', B.player.cx - 30, B.player.cy, 9, 0, { damage: 15, knockback: 2, friendly: false, owner: e });
    let sawShot = false;
    for (let i = 0; i < 12; i++) {
      step(1);
      sawShot ||= B.entities.projectiles.some((p) => !p.friendly && p.o.fromNet);
    }
    expect(sawShot, 'the creature’s shot appears for Bob').toBe(true);
    expect(B.player.life, 'the creature’s shot hurt Bob').toBeLessThan(hpBefore);
  });

  it('mirrors disappear when their owner leaves', () => {
    const { A, B, step } = pair('mp-leave');
    A.god = true;
    B.god = true;
    A.spawnEnemy('gloop', B.player.cx + 40, B.player.bottom - 2);
    step(12);
    expect(puppetsIn(B).length).toBeGreaterThan(0);
    // Alice's game stops sending (she disconnected): only Bob keeps ticking.
    A.mp = null;
    for (let i = 0; i < 200; i++) B.step(1);
    expect(puppetsIn(B).filter((p) => !p.removed).length).toBe(0);
  });
});
