import { User } from '@supabase/supabase-js';
import { supabase } from './client';

export type { User };

export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  // Fire immediately with current session
  supabase.auth.getUser().then(({ data }) => cb(data.user ?? null));

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
    cb(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

/** Native (iOS/Android): exchange Google id_token from expo-auth-session */
export async function signInWithGoogle(idToken: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data.user;
}

/** Web: OAuth redirect flow */
export async function signInWithGooglePopup(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
