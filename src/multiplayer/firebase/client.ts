import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, browserSessionPersistence, inMemoryPersistence, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, type Database } from 'firebase/database';
import { firebaseConfig, USE_EMULATOR } from './config';

export interface FirebaseHandle {
  app: FirebaseApp;
  db: Database;
  /** Anonymous user id (one per browser tab): identifies the player to the database rules. */
  uid: string;
}

let pending: Promise<FirebaseHandle> | null = null;

/**
 * Initialise Firebase and sign in anonymously (once per page). This module is
 * only loaded when the player opens online multiplayer, so single-player never
 * downloads the Firebase SDK.
 */
export function getFirebase(): Promise<FirebaseHandle> {
  pending ??= (async () => {
    const app = initializeApp(firebaseConfig);
    // Per-tab identity: two tabs (or a friend testing on one PC) are two players.
    const auth = initializeAuth(app, { persistence: typeof sessionStorage !== 'undefined' ? browserSessionPersistence : inMemoryPersistence });
    const db = getDatabase(app);
    if (USE_EMULATOR) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectDatabaseEmulator(db, '127.0.0.1', 9000);
    }
    const cred = await signInAnonymously(auth);
    return { app, db, uid: cred.user.uid };
  })().catch((e: unknown) => {
    pending = null;
    throw new Error(friendlyError(e));
  });
  return pending;
}

/** Turn Firebase errors into something a player can act on. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const msg = (e as Error)?.message ?? String(e);
  if (code === 'auth/network-request-failed' || /network/i.test(msg)) return 'Could not reach the online service. Check your internet connection and try again.';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') return 'Online play is not enabled for this site yet (anonymous sign-in is turned off).';
  if (/permission.denied|PERMISSION_DENIED/i.test(msg)) return 'The online service refused that request.';
  return msg;
}
