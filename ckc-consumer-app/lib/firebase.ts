/**
 * lib/firebase.ts
 *
 * Firebase app initialization.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SETUP: Replace the placeholder values below with your actual Firebase config.
 * Find it at: Firebase Console → Project Settings → Your apps → SDK setup
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey:            'AIzaSyBoTyWKQZ3oaf4KjhDikxMOF7bfv5W7Z7U',
  authDomain:        'ckc-recipe-swipe.firebaseapp.com',
  projectId:         'ckc-recipe-swipe',
  storageBucket:     'ckc-recipe-swipe.firebasestorage.app',
  messagingSenderId: '217552239546',
  appId:             '1:217552239546:web:bfd4121d6dccbd694a7b83',
};

// Guard against React Native hot-reload double-initializing the app
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Use platform-appropriate persistence:
// - Native (iOS/Android): AsyncStorage keeps the user logged in across app restarts
// - Web: browserLocalPersistence does the same via localStorage
let auth: ReturnType<typeof getAuth>;
if (Platform.OS === 'web') {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
  });
} else {
  // Dynamically require AsyncStorage to avoid loading it on web
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth };
export const db = getFirestore(app);

export default app;
