import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import TouchableOpacity from '../components/AccessibleTouchable';
import { colors, spacing } from '../theme';
import { signInAsGuest, signInWithEmail, signInWithGoogle } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabase';
import LegalDocumentModal, { LegalDocument } from '../components/LegalDocumentModal';
import { canStartAuthentication } from '../services/accessGate';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [documentsAcknowledged, setDocumentsAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [document, setDocument] = useState<LegalDocument>(null);

  // Guest sign-in works locally without Supabase
  const runGuest = async () => {
    if (!canStartAuthentication(documentsAcknowledged)) {
      setMessage('Please read and acknowledge the Privacy Policy and Terms to continue.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await signInAsGuest();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setMessage(detail);
    } finally {
      setBusy(false);
    }
  };

  // Google / Email sign-in require Supabase
  const run = async (action: () => Promise<void>) => {
    if (!canStartAuthentication(documentsAcknowledged)) {
      setMessage('Please read and acknowledge the Privacy Policy and Terms to continue.');
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage('Google and email sign-in require Supabase to be configured. Use "Continue as guest" to get started without an account.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setMessage(detail);
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    void run(async () => {
      const hasSession = await signInWithEmail(normalizedEmail, password, createAccount);
      if (createAccount && !hasSession) {
        setMessage('Check your email to confirm your account, then sign in.');
      }
    });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Fitness Level</Text>
        <Text style={styles.subtitle}>Sign in to continue across devices, or use a guest account on this device.</Text>
        <TouchableOpacity
          style={styles.documentCheck}
          accessibilityRole="checkbox"
          accessibilityLabel="I have read and acknowledge the Privacy Policy and Terms of Service"
          accessibilityState={{ checked: documentsAcknowledged }}
          onPress={() => setDocumentsAcknowledged((value) => !value)}
        >
          <Text style={styles.checkMark}>{documentsAcknowledged ? '☑' : '☐'}</Text>
          <Text style={styles.documentNote}>I have read and acknowledge the Privacy Policy and Terms of Service.</Text>
        </TouchableOpacity>
        <View style={styles.legalLinks}>
          <TouchableOpacity style={styles.legalLink} accessibilityRole="button" accessibilityLabel="Read Privacy Policy before signing in" onPress={() => setDocument('privacy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.legalLink} accessibilityRole="button" accessibilityLabel="Read Terms of Service before signing in" onPress={() => setDocument('terms')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.googleButton}
          accessibilityLabel="Continue with Google"
          accessibilityHint="Opens Google through Supabase authentication"
          disabled={busy || !canStartAuthentication(documentsAcknowledged)}
          onPress={() => void run(signInWithGoogle)}
        >
          <Text style={styles.googleMark}>G</Text>
          <Text style={styles.googleText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.guestButton}
          accessibilityRole="button"
          accessibilityLabel="Continue as guest"
          accessibilityHint="Creates a local account on this device — no sign-in required"
          disabled={busy || !canStartAuthentication(documentsAcknowledged)}
          onPress={() => void runGuest()}
        >
          <Text style={styles.guestText}>Continue as guest</Text>
        </TouchableOpacity>
        <Text style={styles.guestNote}>Guest progress is tied to this device. Signing out, clearing app data, or reinstalling may make the guest account inaccessible.</Text>

        <View style={styles.separator}><View style={styles.rule} /><Text style={styles.orText}>OR EMAIL</Text><View style={styles.rule} /></View>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          accessibilityLabel="Email address"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8 characters minimum)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete={createAccount ? 'new-password' : 'current-password'}
          textContentType={createAccount ? 'newPassword' : 'password'}
          accessibilityLabel="Password"
          onSubmitEditing={submitEmail}
          returnKeyType="go"
        />
        <TouchableOpacity style={styles.primaryButton} accessibilityLabel={createAccount ? 'Create account with email' : 'Sign in with email'} disabled={busy || !canStartAuthentication(documentsAcknowledged)} onPress={submitEmail}>
          <Text style={styles.primaryText}>{createAccount ? 'Create account' : 'Sign in with email'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} accessibilityLabel={createAccount ? 'Switch to sign in' : 'Switch to create an account'} onPress={() => setCreateAccount((value) => !value)}>
          <Text style={styles.linkText}>{createAccount ? 'Already registered? Sign in' : 'New here? Create an account'}</Text>
        </TouchableOpacity>

        <Text style={styles.privacyNote}>Your profile and workout data are stored in your private Supabase account. Sign in with the same method to restore them on another device.</Text>
        {busy && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        {!isSupabaseConfigured && <Text accessibilityRole="alert" style={styles.configNotice}>Google, email, and guest sign-in are unavailable until the Supabase project URL and publishable key are configured for this build.</Text>}
      </View>
      </ScrollView>
      <LegalDocumentModal document={document} onClose={() => setDocument(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: colors.background, padding: spacing(2) },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: spacing(3), borderWidth: 1, borderColor: colors.border },
  title: { color: colors.textPrimary, textAlign: 'center', fontSize: 30, fontWeight: '800', marginBottom: spacing(1) },
  subtitle: { color: colors.textSecondary, textAlign: 'center', fontSize: 15, lineHeight: 22, marginBottom: spacing(2.5) },
  googleButton: { minHeight: 50, borderRadius: 8, backgroundColor: colors.googleWhite, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  googleMark: { color: colors.googleBlue, fontWeight: '800', fontSize: 19, marginRight: spacing(1) },
  googleText: { color: colors.blackText, fontWeight: '700', fontSize: 15 },
  separator: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing(2) },
  rule: { height: 1, flex: 1, backgroundColor: colors.border },
  orText: { color: colors.textSecondary, fontSize: 12, marginHorizontal: spacing(1.5), fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background, color: colors.textPrimary, paddingHorizontal: spacing(1.5), marginBottom: spacing(1.25), fontSize: 16 },
  primaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: spacing(0.5) },
  primaryText: { color: colors.textOnAccent, fontWeight: '800', fontSize: 15 },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.link, textDecorationLine: 'underline', fontSize: 14 },
  privacyNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing(1.5) },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing(2) },
  legalLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(1) },
  spinner: { marginTop: spacing(1.5) },
  message: { color: colors.warning, fontSize: 14, textAlign: 'center', marginTop: spacing(1.5) },
  configNotice: { color: colors.warning, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: spacing(1) },
  documentCheck: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  documentNote: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: spacing(2) },
  checkMark: { color: colors.accent, fontSize: 22, marginRight: spacing(1) },
  guestButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderColor: colors.border, borderWidth: 1, borderRadius: 8, marginTop: spacing(1) },
  guestText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  guestNote: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing(1) },
});
