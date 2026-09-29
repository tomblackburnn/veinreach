/**
 * End-to-end check of online multiplayer against the Firebase emulators.
 *
 *   npm run emulators          (in one terminal)
 *   npx tsx scripts/online-smoke.ts
 *
 * Two clients join a room and exchange tiles, chests, paintings, flags, chat
 * and player state; a late joiner must receive everything; the security
 * rules must reject bad writes.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, set, get, serverTimestamp } from 'firebase/database';
import { firebaseConfig } from '../src/multiplayer/firebase/config';
import { FirebaseTransport } from '../src/multiplayer/firebase/FirebaseTransport';
import type { FirebaseHandle } from '../src/multiplayer/firebase/client';
import type { ServerMsg } from '../src/multiplayer/protocol';
import { PROTOCOL_VERSION } from '../src/multiplayer/protocol';
import { randomRoomCode, encodeTile } from '../src/multiplayer/firebase/codec';
import { TileRegistry } from '../src/world/TileRegistry';

const apps: ReturnType<typeof initializeApp>[] = [];
async function handle(name: string, signIn = true): Promise<FirebaseHandle> {
  const app = initializeApp(firebaseConfig, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const uid = signIn ? (await signInAnonymously(auth)).user.uid : '';
  return { app, db, uid };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? '✔' : '✘'} ${label}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}
async function denied(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

function client(fb: FirebaseHandle, code: string, name: string) {
  const t = new FirebaseTransport(fb, code);
  const msgs: ServerMsg[] = [];
  const welcome = new Promise<Extract<ServerMsg, { t: 'welcome' }>>((resolve, reject) => {
    t.onMessage = (m) => {
      msgs.push(m);
      if (m.t === 'welcome') resolve(m);
      if (m.t === 'reject') reject(new Error(m.reason));
    };
  });
  t.send({ t: 'hello', version: PROTOCOL_VERSION, name, appearance: {} as never });
  return { t, msgs, welcome };
}

async function main(): Promise<void> {
  const A = await handle('a');
  const B = await handle('b');
  const code = randomRoomCode();
  await set(ref(A.db, `rooms/${code}/meta`), { name: 'Smoke', seed: 'smoke-seed', size: 'small', v: PROTOCOL_VERSION, owner: A.uid, created: serverTimestamp() });
  await set(ref(A.db, `rooms/${code}/time`), { time: 1000, day: 3 });

  const a = client(A, code, 'Alice');
  const wa = await a.welcome;
  check('A joins and gets a welcome', wa.world.seed === 'smoke-seed' && wa.day === 3);
  const b = client(B, code, 'Bob');
  const wb = await b.welcome;
  check('B sees A already in the room', wb.players.some((p) => p.name === 'Alice'), wb.players);
  await sleep(300);
  check('A is told B joined', a.msgs.some((m) => m.t === 'join' && m.player.name === 'Bob'));

  // Tiles, chest, painting, flag, chat, state
  const stone = TileRegistry.id('stone');
  const chest = TileRegistry.id('chest');
  const canvas = TileRegistry.id('canvas_small');
  a.t.send({ t: 'tiles', changes: [10, 20, stone, 0, 3, 11, 20, chest, 0, 0, 30, 20, canvas, 0, 3] });
  a.t.send({ t: 'chest', chest: { x: 11, y: 20, items: [{ id: 'torch', count: 5 }, null, null] } });
  a.t.send({ t: 'paint', painting: { x: 30, y: 20, w: 14, h: 14, px: '5'.repeat(196) } });
  a.t.send({ t: 'flag', flag: 'boss:gravelmaw' });
  a.t.send({ t: 'chat', text: 'hello bob' });
  a.t.send({ t: 'state', x: 100, y: 200, vx: 1, vy: 0, facing: 1, anim: 'run', held: 'torch', armor: [null, null, null], life: 90, maxLife: 100 });
  a.t.send({ t: 'state', x: 110, y: 200, vx: 1, vy: 0, facing: 1, anim: 'run', held: 'torch', armor: [null, null, null], life: 90, maxLife: 100 });
  await sleep(600);
  const bt = b.msgs.filter((m) => m.t === 'tiles').flatMap((m) => (m.t === 'tiles' ? m.changes : []));
  check('B receives A’s tile edits', bt.length === 15 && bt.includes(stone), bt);
  check('A does not receive its own tile echoes', !a.msgs.some((m) => m.t === 'tiles'));
  check('B receives the chest', b.msgs.some((m) => m.t === 'chest' && m.chest.items[0]?.id === 'torch'));
  check('B receives the painting', b.msgs.some((m) => m.t === 'paint' && m.painting.px.startsWith('555')));
  check('B receives the flag', b.msgs.some((m) => m.t === 'flag' && m.flag === 'boss:gravelmaw'));
  check('B receives chat', b.msgs.some((m) => m.t === 'chat' && m.text === 'hello bob' && m.name === 'Alice'));
  check('B receives A’s movement', b.msgs.some((m) => m.t === 'state' && m.x === 110), b.msgs.filter((m) => m.t === 'state'));

  // Late joiner gets everything in the welcome.
  const C = await handle('c');
  const c = client(C, code, 'Cara');
  const wc = await c.welcome;
  check('late joiner gets tiles', (wc.tiles ?? []).length === 15);
  check('late joiner gets the chest', wc.chests.some((ch) => ch.x === 11 && ch.items[0]?.count === 5));
  check('late joiner gets the painting', wc.paintings.some((p) => p.x === 30));
  check('late joiner gets flags', wc.flags.includes('boss:gravelmaw'));
  check('late joiner sees both players', wc.players.length === 2, wc.players.map((p) => p.name));

  // Breaking the chest and canvas clears their stored data.
  a.t.send({ t: 'tiles', changes: [11, 20, 0, 0, 0, 30, 20, 0, 0, 3] });
  await sleep(400);
  const room = (await get(ref(A.db, `rooms/${code}`))).val() as Record<string, Record<string, unknown> | undefined>;
  check('broken chest data removed', !room.chests?.['11_20'], room.chests);
  check('broken canvas painting removed', !room.paintings?.['30_20'], room.paintings);

  // Leaving
  a.t.close();
  await sleep(400);
  check('B is told A left', b.msgs.some((m) => m.t === 'leave'));

  // Security rules
  const anon = await handle('anon', false);
  check('rules: signed-out users cannot read rooms', await denied(get(ref(anon.db, `rooms/${code}`))));
  check('rules: nobody can list all rooms', await denied(get(ref(B.db, 'rooms'))));
  check('rules: room meta cannot be overwritten', await denied(set(ref(B.db, `rooms/${code}/meta/name`), 'Hijacked')));
  check('rules: cannot write another player', await denied(set(ref(B.db, `rooms/${code}/players/${A.uid}`), { info: '{}', s: '{}' })));
  check('rules: tile values are checked', await denied(set(ref(B.db, `rooms/${code}/tiles/5`), 'dirt')));
  check('rules: flags are write-once', await denied(set(ref(B.db, `rooms/${code}/flags/boss:gravelmaw`), true)));
  check('rules: chat must be from yourself', await denied(set(ref(B.db, `rooms/${code}/chat/x`), { uid: A.uid, name: 'A', text: 'spoof', t: serverTimestamp() })));
  check('rules: cannot write to a room that does not exist', await denied(set(ref(B.db, 'rooms/ZZZZZZ/tiles/1'), encodeTile(1, 0, 0))));
  check('rules: bad room codes are refused', await denied(set(ref(B.db, 'rooms/bad/meta'), { name: 'x', seed: 's', size: 'small', v: 2, owner: B.uid, created: serverTimestamp() })));

  b.t.close();
  c.t.close();
  await Promise.all(apps.map((a) => deleteApp(a)));
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll online checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
