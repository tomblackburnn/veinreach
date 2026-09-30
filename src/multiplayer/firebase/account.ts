import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut as fbSignOut, deleteUser, type User,
} from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { getFirebaseCore, friendlyError } from './client';

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export interface AccountState {
  signedIn: boolean;
  email: string | null;
  /** Google accounts are always verified; email accounts after clicking the link. */
  verified: boolean;
  /** Chosen once; shown to other players. */
  username: string | null;
  provider: 'google' | 'password' | null;
}

/** An owned online world occupying one of the account's 5 slots. */
export interface OwnedRoom {
  slot: string;
  code: string;
  name: string;
}

export const MAX_OWNED_ROOMS = 5;

async function user(): Promise<User | null> {
  return (await getFirebaseCore()).auth.currentUser;
}

/** Where the account is in the sign-up flow. */
export async function accountState(): Promise<AccountState> {
  const c = await getFirebaseCore();
  const u = c.auth.currentUser;
  if (!u) return { signedIn: false, email: null, verified: false, username: null, provider: null };
  const provider = u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password';
  let username: string | null = null;
  if (u.emailVerified) {
    try {
      const snap = await get(ref(c.db, `users/${u.uid}/name`));
      username = typeof snap.val() === 'string' ? (snap.val() as string) : null;
    } catch {
      username = null;
    }
  }
  return { signedIn: true, email: u.email, verified: u.emailVerified, username, provider };
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export function signInWithGoogle(): Promise<void> {
  return wrap(async () => {
    const c = await getFirebaseCore();
    await signInWithPopup(c.auth, new GoogleAuthProvider());
  });
}

export function signInWithEmail(email: string, password: string): Promise<void> {
  return wrap(async () => {
    const c = await getFirebaseCore();
    await signInWithEmailAndPassword(c.auth, email.trim(), password);
  });
}

/** Create an email account and send the verification link. */
export function createEmailAccount(email: string, password: string): Promise<void> {
  return wrap(async () => {
    if (password.length < 8) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' });
    const c = await getFirebaseCore();
    const cred = await createUserWithEmailAndPassword(c.auth, email.trim(), password);
    await sendEmailVerification(cred.user);
  });
}

export function resendVerification(): Promise<void> {
  return wrap(async () => {
    const u = await user();
    if (u) await sendEmailVerification(u);
  });
}

/** Re-check whether the email link has been clicked (and refresh the token the rules see). */
export function refreshVerification(): Promise<boolean> {
  return wrap(async () => {
    const u = await user();
    if (!u) return false;
    await u.reload();
    if (u.emailVerified) await u.getIdToken(true);
    return u.emailVerified;
  });
}

export function resetPassword(email: string): Promise<void> {
  return wrap(async () => {
    const c = await getFirebaseCore();
    await sendPasswordResetEmail(c.auth, email.trim());
  });
}

export function signOut(): Promise<void> {
  return wrap(async () => fbSignOut((await getFirebaseCore()).auth));
}

/** Reserve a unique username (case-insensitive) and attach it to the account. Returns an error message or null. */
export async function claimUsername(name: string): Promise<string | null> {
  if (!USERNAME_RE.test(name)) return 'Usernames are 3–16 letters, numbers or underscores.';
  const c = await getFirebaseCore();
  const u = c.auth.currentUser;
  if (!u) return 'Please sign in first.';
  const lower = name.toLowerCase();
  try {
    const taken = await get(ref(c.db, `usernames/${lower}`));
    if (taken.exists() && taken.val() !== u.uid) return 'That username is taken. Try another.';
    await update(ref(c.db), { [`usernames/${lower}`]: u.uid, [`users/${u.uid}/name`]: name });
    return null;
  } catch (e) {
    // A race with someone else claiming the same name ends here too.
    return /permission/i.test(String((e as Error)?.message)) ? 'That username is taken. Try another.' : friendlyError(e);
  }
}

/** The online worlds this account owns (max 5). */
export async function ownedRooms(): Promise<OwnedRoom[]> {
  const c = await getFirebaseCore();
  const u = c.auth.currentUser;
  if (!u) return [];
  const slots = (await get(ref(c.db, `users/${u.uid}/rooms`))).val() as Record<string, string> | null;
  const out: OwnedRoom[] = [];
  for (const [slot, code] of Object.entries(slots ?? {})) {
    let name = code;
    try {
      const meta = (await get(ref(c.db, `rooms/${code}/meta/name`))).val();
      if (typeof meta === 'string') name = meta;
    } catch {
      /* keep the code as the name */
    }
    out.push({ slot, code, name });
  }
  return out.sort((a, b) => a.slot.localeCompare(b.slot));
}

/** Permanently delete an owned world and free its slot. */
export function deleteOwnedRoom(room: OwnedRoom): Promise<void> {
  return wrap(async () => {
    const c = await getFirebaseCore();
    const u = c.auth.currentUser;
    if (!u) throw new Error('Please sign in first.');
    await update(ref(c.db), { [`rooms/${room.code}`]: null, [`users/${u.uid}/rooms/${room.slot}`]: null });
  });
}

/** Delete the account: its worlds, username and profile, then the login itself. */
export function deleteAccount(): Promise<void> {
  return wrap(async () => {
    const c = await getFirebaseCore();
    const u = c.auth.currentUser;
    if (!u) return;
    for (const r of await ownedRooms()) await deleteOwnedRoom(r);
    const name = (await get(ref(c.db, `users/${u.uid}/name`))).val() as string | null;
    const paths: Record<string, null> = { [`users/${u.uid}`]: null };
    if (name) paths[`usernames/${name.toLowerCase()}`] = null;
    await update(ref(c.db), paths);
    await deleteUser(u);
  });
}
