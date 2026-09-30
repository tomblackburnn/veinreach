/**
 * End-to-end check of online multiplayer against the Firebase emulators.
 *
 *   npm run emulators          (in one terminal)
 *   npx tsx scripts/online-smoke.ts
 *
 * Covers accounts (verified email, unique usernames), world ownership limits,
 * membership (join, lock, kick, ban), syncing between players, late joining,
 * and that the security rules reject everything they should.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, set, get, update, remove, serverTimestamp } from 'firebase/database';
import { firebaseConfig } from '../src/multiplayer/firebase/config';
import { FirebaseTransport } from '../src/multiplayer/firebase/FirebaseTransport';
import type { FirebaseHandle } from '../src/multiplayer/firebase/client';
import type { ServerMsg } from '../src/multiplayer/protocol';
import { PROTOCOL_VERSION } from '../src/multiplayer/protocol';
import { randomRoomCode, encodeTile } from '../src/multiplayer/firebase/codec';
import { TileRegistry } from '../src/world/TileRegistry';

const apps: ReturnType<typeof initializeApp>[] = [];
const run = Date.now().toString(36);

/** A Google-verified account (the emulator accepts unsigned test tokens). */
async function googleUser(tag: string): Promise<FirebaseHandle> {
  const app = initializeApp(firebaseConfig, `${tag}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `${tag}-${run}`, email: `${tag}-${run}@example.com`, email_verified: true })));
  return { app, db, uid: cred.user.uid };
}

async function unverifiedUser(): Promise<FirebaseHandle> {
  const app = initializeApp(firebaseConfig, `unverified-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const cred = await createUserWithEmailAndPassword(auth, `unverified-${run}@example.com`, 'password123');
  return { app, db, uid: cred.user.uid };
}

const claim = (u: FirebaseHandle, name: string) => update(ref(u.db), { [`usernames/${name.toLowerCase()}`]: u.uid, [`users/${u.uid}/name`]: name });

async function createRoom(u: FirebaseHandle, name: string, slot: string): Promise<string> {
  const code = randomRoomCode();
  await update(ref(u.db), { [`rooms/${code}/meta`]: { name, seed: 'smoke-seed', size: 'small', v: PROTOCOL_VERSION, owner: u.uid, created: serverTimestamp(), slot }, [`users/${u.uid}/rooms/${slot}`]: code });
  const uname = (await get(ref(u.db, `users/${u.uid}/name`))).val() as string;
  await set(ref(u.db, `rooms/${code}/members/${u.uid}`), { name: uname, joined: serverTimestamp() });
  await set(ref(u.db, `rooms/${code}/time`), { time: 1000, day: 3 });
  return code;
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

function join(fb: FirebaseHandle, code: string, username: string) {
  const t = new FirebaseTransport(fb, code, username);
  const msgs: ServerMsg[] = [];
  let closedWith = '';
  t.onClose = (r) => (closedWith = r);
  const welcome = new Promise<Extract<ServerMsg, { t: 'welcome' }>>((resolve, reject) => {
    t.onMessage = (m) => {
      msgs.push(m);
      if (m.t === 'welcome') resolve(m);
      if (m.t === 'reject') reject(new Error(m.reason));
    };
  });
  t.send({ t: 'hello', version: PROTOCOL_VERSION, name: 'Character', appearance: {} as never });
  return { t, msgs, welcome, closed: () => closedWith };
}

async function main(): Promise<void> {
  const A = await googleUser('alice');
  const B = await googleUser('bob');
  const E = await googleUser('eve');
  const U = await unverifiedUser();
  const nA = `Alice_${run}`.slice(0, 16);
  const nB = `Bob_${run}`.slice(0, 16);
  const nE = `Eve_${run}`.slice(0, 16);

  console.log('— Accounts');
  check('unverified email accounts cannot take a username', await denied(claim(U, `Unv_${run}`.slice(0, 16))));
  await claim(A, nA);
  await claim(B, nB);
  check('usernames are unique (case-insensitive)', await denied(claim(E, nA.toUpperCase())));
  await claim(E, nE);
  check('a username cannot be changed or a second one taken', await denied(claim(A, `Al2_${run}`.slice(0, 16))));
  check('invalid usernames are refused', await denied(update(ref(U.db), { 'usernames/a b': U.uid })));

  console.log('— Owning worlds');
  const code = await createRoom(A, 'Smoke', '1');
  check('a named, verified player can create a world', !!code);
  check('unverified users cannot even read world info', await denied(get(ref(U.db, `rooms/${code}/meta`))));
  check('cannot take a slot that is still in use', await denied(update(ref(A.db), { [`rooms/QQQQQQ/meta`]: { name: 'x', seed: 's', size: 'small', v: 2, owner: A.uid, created: serverTimestamp(), slot: '1' }, [`users/${A.uid}/rooms/1`]: 'QQQQQQ' })));
  check('there are only 5 slots', await denied(update(ref(A.db), { [`rooms/QQQQQR/meta`]: { name: 'x', seed: 's', size: 'small', v: 2, owner: A.uid, created: serverTimestamp(), slot: '6' }, [`users/${A.uid}/rooms/6`]: 'QQQQQR' })));
  check('cannot create a world owned by someone else', await denied(update(ref(E.db), { [`rooms/QQQQQS/meta`]: { name: 'x', seed: 's', size: 'small', v: 2, owner: A.uid, created: serverTimestamp(), slot: '1' }, [`users/${E.uid}/rooms/1`]: 'QQQQQS' })));

  console.log('— Joining and syncing');
  const a = join(A, code, nA);
  await a.welcome;
  check('non-members cannot read the world', await denied(get(ref(E.db, `rooms/${code}/tiles`))));
  check('non-members cannot edit the world', await denied(set(ref(E.db, `rooms/${code}/tiles/5`), encodeTile(1, 0, 0))));
  const b = join(B, code, nB);
  const wb = await b.welcome;
  check('Bob joins and sees Alice by username', wb.players.some((p) => p.name === nA), wb.players);

  const stone = TileRegistry.id('stone');
  const chest = TileRegistry.id('chest');
  a.t.send({ t: 'tiles', changes: [10, 20, stone, 0, 3, 11, 20, chest, 0, 0] });
  a.t.send({ t: 'chest', chest: { x: 11, y: 20, items: [{ id: 'torch', count: 5 }] } });
  a.t.send({ t: 'paint', painting: { x: 30, y: 20, w: 14, h: 14, px: '5'.repeat(196) } });
  a.t.send({ t: 'flag', flag: 'boss:gravelmaw' });
  a.t.send({ t: 'chat', text: 'hello bob' });
  a.t.send({ t: 'state', x: 100, y: 200, vx: 1, vy: 0, facing: 1, anim: 'run', held: null, armor: [], life: 90, maxLife: 100 });
  a.t.send({ t: 'state', x: 110, y: 200, vx: 1, vy: 0, facing: 1, anim: 'run', held: null, armor: [], life: 90, maxLife: 100 });
  await sleep(700);
  check('tiles sync', b.msgs.some((m) => m.t === 'tiles' && m.changes.includes(stone)));
  check('chests sync', b.msgs.some((m) => m.t === 'chest' && m.chest.items[0]?.id === 'torch'));
  check('paintings sync', b.msgs.some((m) => m.t === 'paint'));
  check('flags sync', b.msgs.some((m) => m.t === 'flag' && m.flag === 'boss:gravelmaw'));
  check('chat syncs under the username', b.msgs.some((m) => m.t === 'chat' && m.name === nA && m.text === 'hello bob'));
  check('movement syncs', b.msgs.some((m) => m.t === 'state' && m.x === 110));
  check('roster shows both members online', a.t.roster().members.filter((m) => m.online).length === 2, a.t.roster());

  console.log('— Shared creatures');
  a.t.send({ t: 'mobs', tag: 'aaaa2', list: [{ n: 'aaaa2.1', id: 'gloop', x: 100, y: 200, vx: 0, vy: 0, f: 1, l: 20, ml: 22, s: 'idle', dm: 7, df: 0 }] });
  b.t.send({ t: 'ev', tag: 'bbbb3', ev: [{ k: 'hit', n: 'aaaa2.1', d: 5, kb: 1, dx: 1 }] });
  await sleep(700);
  check('creature snapshots reach other players', b.msgs.some((m) => m.t === 'mobs' && m.tag === 'aaaa2' && m.list[0]?.id === 'gloop'));
  check('hits reach the creature’s owner', a.msgs.some((m) => m.t === 'ev' && m.tag === 'bbbb3' && m.ev[0]?.k === 'hit'));
  check('non-members cannot send creature data', await denied(set(ref(E.db, `rooms/${code}/mobs/eeee4`), '[]')));
  check('events need a server timestamp', await denied(set(ref(B.db, `rooms/${code}/ev/x`), { f: 'bbbb3', t: 1, e: '[]' })));

  console.log('— Impersonation');
  check('cannot chat as someone else', await denied(set(ref(B.db, `rooms/${code}/chat/x1`), { uid: A.uid, name: nA, text: 'spoof', t: serverTimestamp() })));
  check('cannot chat under a fake name', await denied(set(ref(B.db, `rooms/${code}/chat/x2`), { uid: B.uid, name: nA, text: 'spoof', t: serverTimestamp() })));
  check('cannot show a fake name on your avatar', await denied(set(ref(B.db, `rooms/${code}/players/${B.uid}`), { name: nA, info: '{}', s: '{}' })));
  check('cannot move another player', await denied(set(ref(B.db, `rooms/${code}/players/${A.uid}/s`), '{}')));
  check('world info cannot be changed', await denied(set(ref(B.db, `rooms/${code}/meta/name`), 'Hijacked')));

  console.log('— Owner powers');
  check('members cannot lock the world', await denied(set(ref(B.db, `rooms/${code}/settings/locked`), true)));
  check('members cannot kick others', await denied(remove(ref(B.db, `rooms/${code}/members/${A.uid}`))));
  check('members cannot ban others', await denied(set(ref(B.db, `rooms/${code}/bans/${A.uid}`), { name: nA, at: serverTimestamp() })));
  check('members cannot delete the world', await denied(remove(ref(B.db, `rooms/${code}`))));
  await a.t.setLocked(true);
  await sleep(200);
  const locked = await join(E, code, nE).welcome.then(() => '', (e: Error) => e.message);
  check('a locked world refuses new players', /locked/i.test(locked), locked);
  check('…even if they write the membership themselves', await denied(set(ref(E.db, `rooms/${code}/members/${E.uid}`), { name: nE, joined: serverTimestamp() })));
  await a.t.setLocked(false);

  await a.t.kick(B.uid);
  await sleep(500);
  check('a kicked player is disconnected', /removed/i.test(b.closed()), b.closed());
  check('a kicked player can no longer edit', await denied(set(ref(B.db, `rooms/${code}/tiles/7`), encodeTile(1, 0, 0))));
  const b2 = join(B, code, nB);
  await b2.welcome;
  check('a kicked (not banned) player can rejoin', true);
  await a.t.ban(B.uid);
  await sleep(500);
  check('a banned player who is online is disconnected and told why', /banned/i.test(b2.closed()), b2.closed());
  const banned = await join(B, code, nB).welcome.then(() => '', (e: Error) => e.message);
  check('a banned player cannot rejoin', /banned/i.test(banned), banned);
  check('…even by writing membership directly', await denied(set(ref(B.db, `rooms/${code}/members/${B.uid}`), { name: nB, joined: serverTimestamp() })));
  check('the owner sees the ban list', a.t.roster().bans.some((x) => x.uid === B.uid), a.t.roster().bans);
  await a.t.unban(B.uid);
  const b3 = join(B, code, nB);
  await b3.welcome.catch(() => undefined);
  check('after an unban they can rejoin', b3.msgs.some((m) => m.t === 'welcome'));

  console.log('— Late join');
  const e = join(E, code, nE);
  const we = await e.welcome;
  check('late joiner gets tiles, chest, painting and flags', (we.tiles ?? []).length >= 10 && we.chests.length === 1 && we.paintings.length === 1 && we.flags.includes('boss:gravelmaw'));

  console.log('— Deleting');
  a.t.close();
  b3.t.close();
  e.t.close();
  await sleep(300);
  await update(ref(A.db), { [`rooms/${code}`]: null, [`users/${A.uid}/rooms/1`]: null });
  check('the owner can delete the world and free the slot', !(await get(ref(A.db, `users/${A.uid}/rooms/1`))).exists());

  await Promise.all(apps.map((x) => deleteApp(x)));
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll online checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
