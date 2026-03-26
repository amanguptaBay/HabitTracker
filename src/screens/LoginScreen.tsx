import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';
import { signInWithGoogle, confirmPhoneCode } from '../services/auth';

// Required for Google sign-in redirect to close the browser tab automatically
WebBrowser.maybeCompleteAuthSession();

// ─── TODO: Add your client IDs ───────────────────────────────────────────────
// Firebase Console → Authentication → Sign-in method → Google → Web client ID
const WEB_CLIENT_ID    = 'YOUR_WEB_CLIENT_ID';
// Google Cloud Console → APIs & Services → Credentials → iOS OAuth client
const IOS_CLIENT_ID    = 'YOUR_IOS_CLIENT_ID';
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'choose' | 'phone-number' | 'phone-otp';

export default function LoginScreen() {
  const [step, setStep]         = useState<Step>('choose');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState('');
  const [verificationId, setVId]= useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);

  // ── Google ──────────────────────────────────────────────────────────────────
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
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [googleResponse]);

  // ── Phone — step 1: send code ────────────────────────────────────────────────
  const handleSendCode = async () => {
    setError('');
    if (!phone.trim()) { setError('Enter a phone number.'); return; }
    setLoading(true);
    try {
      const provider = new PhoneAuthProvider(auth);
      const vId = await provider.verifyPhoneNumber(phone.trim(), recaptchaRef.current!);
      setVId(vId);
      setStep('phone-otp');
    } catch (e: any) {
      setError(e.message ?? 'Failed to send code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phone — step 2: confirm OTP ──────────────────────────────────────────────
  const handleConfirmOtp = async () => {
    setError('');
    if (otp.trim().length < 4) { setError('Enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      await confirmPhoneCode(verificationId, otp.trim());
      // Auth state observer in App.tsx handles navigation
    } catch (e: any) {
      setError(e.message ?? 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* reCAPTCHA — invisible until phone auth triggers it */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={auth.app.options}
        attemptInvisibleVerification
      />

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

        {/* ── Step: choose method ───────────────────────────────────────── */}
        {step === 'choose' && (
          <>
            <Text style={styles.cardTitle}>Get started</Text>

            {/* Google */}
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnGoogle, pressed && styles.btnPressed]}
              onPress={() => { setError(''); promptGoogleAsync(); }}
              disabled={loading}
            >
              <Text style={styles.btnGoogleLogo}>G</Text>
              <Text style={styles.btnGoogleText}>Continue with Google</Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Phone */}
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPhone, pressed && styles.btnPressed]}
              onPress={() => { setError(''); setStep('phone-number'); }}
              disabled={loading}
            >
              <Text style={styles.btnPhoneText}>Continue with Phone Number</Text>
            </Pressable>
          </>
        )}

        {/* ── Step: phone number entry ──────────────────────────────────── */}
        {step === 'phone-number' && (
          <>
            <Pressable onPress={() => { setStep('choose'); setError(''); }} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Text style={styles.cardTitle}>Your number</Text>
            <Text style={styles.cardSub}>We'll send a one-time code to verify.</Text>

            <TextInput
              style={styles.input}
              placeholder="+1 555 000 0000"
              placeholderTextColor="#bbb"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPhone, pressed && styles.btnPressed]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPhoneText}>Send Code</Text>}
            </Pressable>
          </>
        )}

        {/* ── Step: OTP entry ───────────────────────────────────────────── */}
        {step === 'phone-otp' && (
          <>
            <Pressable onPress={() => { setStep('phone-number'); setError(''); }} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <Text style={styles.cardTitle}>Enter code</Text>
            <Text style={styles.cardSub}>Sent to {phone}</Text>

            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />

            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPhone, pressed && styles.btnPressed]}
              onPress={handleConfirmOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnPhoneText}>Verify & Sign In</Text>}
            </Pressable>
          </>
        )}

        {/* Error */}
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

  // Hero
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
    fontWeight: '400',
  },

  // Card
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
  cardSub: {
    fontSize: 14,
    color: '#888',
    marginTop: -6,
    marginBottom: 4,
  },

  // Buttons
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
  btnPhone: {
    backgroundColor: '#4CAF50',
  },
  btnPhoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#333',
  },
  dividerText: {
    fontSize: 13,
    color: '#555',
  },

  // Input
  input: {
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
  },

  // Back
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: -4,
  },
  backText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Error
  errorText: {
    fontSize: 13,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 4,
  },
});
