import { ref, get, update, remove, query, orderByChild, equalTo, type Database } from 'firebase/database';

/**
 * Remove what this account left in one online world: its chat messages,
 * player entry and membership, and the world from its joined list. Bans are
 * kept (the owner needs them). Worlds that are gone, or that we can no longer
 * read (kicked/banned), are skipped; their chat expires within a day anyway.
 */
export async function leaveRoomData(db: Database, uid: string, code: string): Promise<void> {
  const base = `rooms/${code}`;
  try {
    const mine = await get(query(ref(db, `${base}/chat`), orderByChild('uid'), equalTo(uid)));
    const paths: Record<string, null> = {};
    mine.forEach((c) => {
      paths[`${base}/chat/${c.key}`] = null;
    });
    if (Object.keys(paths).length) await update(ref(db), paths);
  } catch {
    /* no longer readable */
  }
  await remove(ref(db, `${base}/players/${uid}`)).catch(() => undefined);
  await remove(ref(db, `${base}/members/${uid}`)).catch(() => undefined);
  await remove(ref(db, `users/${uid}/joined/${code}`)).catch(() => undefined);
}

/** Everything an account has in the database: joined worlds, owned worlds, username and profile. */
export async function purgeAccountData(db: Database, uid: string): Promise<void> {
  const joined = Object.keys(((await get(ref(db, `users/${uid}/joined`))).val() ?? {}) as Record<string, true>);
  const owned = ((await get(ref(db, `users/${uid}/rooms`))).val() ?? {}) as Record<string, string>;
  const ownedCodes = new Set(Object.values(owned));
  for (const code of joined) if (!ownedCodes.has(code)) await leaveRoomData(db, uid, code);
  for (const [slot, code] of Object.entries(owned)) await update(ref(db), { [`rooms/${code}`]: null, [`users/${uid}/rooms/${slot}`]: null });
  const name = (await get(ref(db, `users/${uid}/name`))).val() as string | null;
  const paths: Record<string, null> = { [`users/${uid}`]: null };
  if (name) paths[`usernames/${name.toLowerCase()}`] = null;
  await update(ref(db), paths);
}
