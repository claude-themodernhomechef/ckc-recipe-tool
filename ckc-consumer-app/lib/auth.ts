/**
 * lib/auth.ts
 *
 * Firebase Auth helper functions.
 * All screens import from here — never import firebase/auth directly in screens.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';

// ── Sign up ──────────────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Sign in ──────────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// ── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// ── Auth state listener ───────────────────────────────────────────────────────

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

// ── Google sign-in (web only) ─────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  if (Platform.OS !== 'web') {
    throw new Error('Google sign-in is only available on web for now.');
  }
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

// ── Re-export User type for convenience ──────────────────────────────────────

export type { User };
