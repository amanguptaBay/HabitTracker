import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle, signInWithGooglePopup } from '../services/supabase/auth';

// Required for Google OAuth redirect to close the in-app browser automatically
WebBrowser.maybeCompleteAuthSession();

// ─── Client IDs ───────────────────────────────────────────────────────────────
// Google Cloud Console → APIs & Services → Credentials
const WEB_CLIENT_ID = '164879829524-jvjg0uddj2d8frf7u4k92cbtgpq2s5cf';
const IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID';
// ─────────────────────────────────────────────────────────────────────────────

const isWeb = Platform.OS === 'web';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── Google (native) ──────────────────────────────────────────────────────────
  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (!idToken) { setError('Google sign-in failed — no token returned.'); return; }
      setLoading(true);
      signInWithGoogle(idToken)
        .catch((e: any) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [googleResponse]);

  // ── Google (web) ─────────────────────────────────────────────────────────────
  const handleGooglePress = async () => {
    setError('');
    setLoading(true);
    try {
      if (isWeb) {
        await signInWithGooglePopup();
      } else {
        promptGoogleAsync();
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed.');
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoEmoji}>✦</Text>
        </View>
        <Text style={styles.appName}>Ritual</Text>
        <Text style={styles.tagline}>Build habits that stick.</Text>
      </View>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Get started</Text>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnGoogle, pressed && styles.btnPressed]}
          onPress={handleGooglePress}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#1a1a1a" />
            : <>
                <Text style={styles.btnGoogleLogo}>G</Text>
                <Text style={styles.btnGoogleText}>Continue with Google</Text>
              </>}
        </Pressable>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  logoEmoji: {
    fontSize: 28,
    color: '#fff',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
  },
  card: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 24,
    gap: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  btnGoogle: {
    backgroundColor: '#fff',
  },
  btnGoogleLogo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  btnGoogleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  errorText: {
    fontSize: 13,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 4,
  },
});
