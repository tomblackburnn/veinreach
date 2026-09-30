import { describe, it, expect } from 'vitest';
import { generateWorldSync } from '../src/generation/WorldGenerator';
import { SimContext } from './helpers/SimContext';
import { trackOfflineEdits, applyRoomSnapshot, pendingTiles, markPending, pendingCount } from '../src/multiplayer/linkedWorlds';
import { defaultWorldState } from '../src/world/WorldState';
import { validateWorldRecord } from '../src/save/validation';
import { TileRegistry } from '../src/world/TileRegistry';
import { encodeTile } from '../src/multiplayer/firebase/codec';

describe('linked single-player copies of online worlds', () => {
  const g = generateWorldSync({ name: 'link', seed: 'linked', width: 420, height: 260 });
  const w = g.world;
  const brick = TileRegistry.id('stone_brick');
  const glass = TileRegistry.id('glass');

  it('records single-player edits (tiles, chests, paintings, flags) for upload', () => {
    const ctx = new SimContext(w);
    const st = defaultWorldState();
    const stop = trackOfflineEdits(w, st, ctx.bus);
    w.setFg(10, 20, brick, 0);
    w.setWall(11, 20, 3);
    ctx.progression.set('boss:gravelmaw');
    markPending(st, 'chests', '5,6');
    markPending(st, 'chests', '5,6');
    stop();
    w.setFg(12, 20, brick, 0); // after stopping: not recorded
    const p = st.pendingOnline!;
    expect(p.tiles[String(20 * w.width + 10)]).toBe(encodeTile(brick, 0, w.getWall(10, 20)));
    expect(p.tiles[String(20 * w.width + 11)]).toBeDefined();
    expect(p.tiles[String(20 * w.width + 12)]).toBeUndefined();
    expect(p.flags).toContain('boss:gravelmaw');
    expect(p.chests).toEqual(['5,6']);
    expect(pendingCount(p)).toBe(4);
    expect(pendingTiles(p, w.width)).toContainEqual([10, 20, brick, 0, w.getWall(10, 20)]);
  });

  it('pulls online changes into the copy, but the host’s offline edits win', () => {
    const st = defaultWorldState();
    st.pendingOnline = { tiles: { [String(30 * w.width + 40)]: encodeTile(brick, 0, 0) }, chests: [], paintings: [], flags: [] };
    w.setFg(40, 30, brick, 0);
    const n = applyRoomSnapshot(w, st, {
      tiles: [40, 30, glass, 0, 0, 41, 30, glass, 0, 0],
      liquids: [],
      chests: [],
      paintings: [],
      flags: ['boss:thornwarden', 'unsealed', 'unseal:done'],
      time: 1234,
      day: 7,
    });
    expect(n).toBe(1);
    expect(w.getFg(40, 30)).toBe(brick); // offline edit kept
    expect(w.getFg(41, 30)).toBe(glass); // online edit pulled in
    expect(st.flags).toContain('boss:thornwarden');
    // Unsealed online: the copy replays the Unsealing itself rather than skipping it.
    expect(st.flags).toContain('unsealed');
    expect(st.flags).not.toContain('unseal:done');
    expect(st.day).toBe(7);
  });

  it('keeps the link and pending edits through save validation', () => {
    const st = { ...defaultWorldState(), pendingOnline: { tiles: { '123': 5, bad: 1, '9': -1 }, chests: ['1,2'], paintings: [], flags: ['x'] } };
    const rec = validateWorldRecord({ id: 'w', meta: { id: 'w', seed: 's', name: 'n', size: 'small', onlineCode: 'K7QM2X' }, state: st });
    expect(rec.meta.onlineCode).toBe('K7QM2X');
    expect(rec.state.pendingOnline).toEqual({ tiles: { '123': 5 }, chests: ['1,2'], paintings: [], flags: ['x'] });
    const bad = validateWorldRecord({ id: 'w', meta: { id: 'w', seed: 's', name: 'n', size: 'small', onlineCode: 'nope' }, state: defaultWorldState() });
    expect(bad.meta.onlineCode).toBeUndefined();
  });
});
