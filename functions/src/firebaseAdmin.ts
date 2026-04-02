/**
 * Shared Firebase Admin initialization.
 * Import `db` and `bucket` from here instead of calling initializeApp() in each file.
 */
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db     = admin.firestore();
export const bucket = admin.storage().bucket('ckc-recipe-swipe.firebasestorage.app');
