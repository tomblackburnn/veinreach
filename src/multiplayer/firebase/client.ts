import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, inMemoryPersistence, browserPopupRedirectResolver, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, type Database } from 'firebase/database';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseConfig, USE_EMULATOR, APP_CHECK_SITE_KEY } from './config';

export interface FirebaseCore {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

/** A signed-in player ready to use the database. */
export interface FirebaseHandle {
  app: FirebaseApp;
  db: Database;
  /** The player's account id: identifies them to the database rules. */
  uid: string;
}

let core: Promise<FirebaseCore> | null = null;

/**
 * Initialise Firebase once per page. This module is only loaded when the
 * player opens online multiplayer, so single-player never downloads the SDK.
 */
export function getFirebaseCore(): Promise<FirebaseCore> {
  core ??= (async () => {
    const app = initializeApp(firebaseConfig);
    // App Check proves requests come from this website (not scripts). It is
    // switched on by setting APP_CHECK_SITE_KEY once the site has its domain.
    if (APP_CHECK_SITE_KEY && !USE_EMULATOR && typeof window !== 'undefined') {
      if (location.hostname === 'localhost') (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
    const browser = typeof window !== 'undefined';
    const auth = initializeAuth(app, browser ? { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver } : { persistence: inMemoryPersistence });
    const db = getDatabase(app);
    if (USE_EMULATOR) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectDatabaseEmulator(db, '127.0.0.1', 9000);
    }
    await auth.authStateReady();
    return { app, auth, db };
  })().catch((e: unknown) => {
    core = null;
    throw new Error(friendlyError(e));
  });
  return core;
}

/** The signed-in player's handle; throws if nobody is signed in. */
export async function getFirebase(): Promise<FirebaseHandle> {
  const c = await getFirebaseCore();
  const u = c.auth.currentUser;
  if (!u) throw new Error('Please sign in to play online.');
  return { app: c.app, db: c.db, uid: u.uid };
}

/** Turn Firebase errors into something a player can act on. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const msg = (e as Error)?.message ?? String(e);
  const known: Record<string, string> = {
    'auth/network-request-failed': 'Could not reach the online service. Check your internet connection and try again.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Please enter a password.',
    'auth/weak-password': 'Passwords need at least 8 characters.',
    'auth/email-already-in-use': 'There is already an account with that email. Try signing in instead.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'Wrong email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
    'auth/requires-recent-login': 'For your security, sign out and sign back in, then try again.',
    'auth/operation-not-allowed': 'That sign-in method isn’t enabled for this site yet.',
    'auth/unauthorized-domain': 'Sign-in isn’t enabled for this web address yet.',
  };
  if (known[code]) return known[code];
  if (/permission.denied|PERMISSION_DENIED/i.test(msg)) return 'The online service refused that request.';
  return msg.replace(/^Firebase:\s*/, '');
}
