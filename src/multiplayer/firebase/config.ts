/**
 * Firebase web configuration for the Veinreach project. These values are
 * public identifiers, not secrets: access is controlled by the Realtime
 * Database security rules (database.rules.json) and Firebase Auth.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBFTzMyfv7GE93jDKoyLBAlyW_fgSWRsrY',
  authDomain: 'veinreach-game.firebaseapp.com',
  databaseURL: 'https://veinreach-game-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'veinreach-game',
  storageBucket: 'veinreach-game.firebasestorage.app',
  messagingSenderId: '361024917241',
  appId: '1:361024917241:web:b8701f4d4583dc79f65c28',
};

/** `VITE_FIREBASE_EMULATOR=1 npm run dev` talks to the local emulators (npm run emulators). */
export const USE_EMULATOR = import.meta.env?.VITE_FIREBASE_EMULATOR === '1';
