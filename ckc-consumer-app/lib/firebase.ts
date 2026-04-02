// ─────────────────────────────────────────────
//  Firebase app initialization
//  Uses the web/modular SDK (v10+) which works
//  across Expo web, iOS, and Android.
// ─────────────────────────────────────────────

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyBoTyWKQZ3oaf4KjhDikxMOF7bfv5W7Z7U',
  authDomain:        'ckc-recipe-swipe.firebaseapp.com',
  projectId:         'ckc-recipe-swipe',
  storageBucket:     'ckc-recipe-swipe.firebasestorage.app',
  messagingSenderId: '217552239546',
  appId:             '1:217552239546:web:bfd4121d6dccbd694a7b83',
};

// Prevent re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
