import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { saveConsentAcceptedAt } from '../services/userData';
import { colors, spacing } from '../theme';
import { useStore } from '../store';
import LegalDocumentModal, { LegalDocument } from '../components/LegalDocumentModal';
import TouchableOpacity from '../components/AccessibleTouchable';

export default function ConsentScreen() {
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const [document, setDocument] = useState<LegalDocument>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const setConsentAcceptedAt = useStore((state) => state.setConsentAcceptedAt);
  const authUserId = useStore((state) => state.authUserId);

  const accept = async () => {
    if (!documentsAccepted || saving) return;
    setSaving(true);
    try {
      const acceptedAt = new Date().toISOString();
      if (!authUserId) throw new Error('Sign in is required before saving consent.');
      await saveConsentAcceptedAt(authUserId, acceptedAt);
      setConsentAcceptedAt(acceptedAt);
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>Before you continue</Text>
      <Text style={styles.body}>
        Please review the draft Privacy Policy and Terms of Service before continuing.
      </Text>
      <TouchableOpacity
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: documentsAccepted }}
        accessibilityLabel="I have read and acknowledge the Privacy Policy and Terms of Service"
        accessibilityHint="Open each document to review it"
        onPress={() => setDocumentsAccepted(!documentsAccepted)}
      >
        <Text style={styles.checkText}>{documentsAccepted ? '☑' : '☐'} I have read and acknowledge the</Text>
      </TouchableOpacity>
      <View style={styles.linkRow}>
        <TouchableOpacity style={styles.linkButton} accessibilityRole="button" accessibilityLabel="Read Privacy Policy" onPress={() => setDocument('privacy')}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.body}>and</Text>
        <TouchableOpacity style={styles.linkButton} accessibilityRole="button" accessibilityLabel="Read Terms of Service" onPress={() => setDocument('terms')}>
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, (!documentsAccepted || saving) && styles.disabledButton]}
        accessibilityRole="button"
        accessibilityLabel="Continue to Fitness Level"
        accessibilityHint="Stores your acknowledgement and accepted document versions in your Supabase account"
        accessibilityState={{ disabled: !documentsAccepted || saving }}
        disabled={!documentsAccepted || saving}
        onPress={accept}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue'}</Text>
      </TouchableOpacity>
      {saveError && <Text accessibilityRole="alert" style={styles.notice}>Your acknowledgement could not be saved to your account. Check your connection and try again.</Text>}
      <LegalDocumentModal document={document} onClose={() => setDocument(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors.background, padding: spacing(3) },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: 'bold', marginBottom: spacing(2) },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
  checkRow: { minHeight: 48, justifyContent: 'center', marginTop: spacing(1) },
  checkText: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
  linkRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: spacing(0.5) },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(0.5) },
  link: { color: colors.link, fontSize: 16, textDecorationLine: 'underline' },
  primaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: spacing(2) },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: 'bold' },
  notice: { color: colors.warning, fontSize: 16, lineHeight: 24, marginTop: spacing(1) },
});
