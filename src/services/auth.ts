import {
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  GoogleAuthProvider,
  PhoneAuthProvider,
  linkWithCredential,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

// ─── Auth state ───────────────────────────────────────────────────────────────

export function subscribeToAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export const getCurrentUser = () => auth.currentUser;

// ─── Google ───────────────────────────────────────────────────────────────────

/**
 * Sign in (or link) with a Google id_token obtained from expo-auth-session.
 * Used on iOS/Android. If an anonymous user exists we link to preserve data.
 */
export async function signInWithGoogle(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const existing = auth.currentUser;

  if (existing?.isAnonymous) {
    const result = await linkWithCredential(existing, credential);
    return result.user;
  }

  const result = await signInWithCredential(auth, credential);
  return result.user;
}

/**
 * Web-only: sign in with Google via popup window.
 */
export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const existing = auth.currentUser;

  if (existing?.isAnonymous) {
    const result = await linkWithCredential(existing, await signInWithPopup(auth, provider).then(r => GoogleAuthProvider.credentialFromResult(r)!));
    return result.user;
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// ─── Phone ────────────────────────────────────────────────────────────────────

/**
 * Confirm the SMS code returned from verifyPhoneNumber.
 * Links to an existing anonymous session if one is present.
 */
export async function confirmPhoneCode(
  verificationId: string,
  code: string
): Promise<User> {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const existing = auth.currentUser;

  if (existing?.isAnonymous) {
    const result = await linkWithCredential(existing, credential);
    return result.user;
  }

  const result = await signInWithCredential(auth, credential);
  return result.user;
}

export async function signOut() {
  return auth.signOut();
}
