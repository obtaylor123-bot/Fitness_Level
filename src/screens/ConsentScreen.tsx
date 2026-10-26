import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { saveConsentAcceptedAt } from '../db/database';
import { MINIMUM_AGE } from '../config/business';
import { colors, spacing } from '../theme';
import { useStore } from '../store';
import LegalDocumentModal, { LegalDocument } from '../components/LegalDocumentModal';
import TouchableOpacity from '../components/AccessibleTouchable';

export default function ConsentScreen() {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [documentsAccepted, setDocumentsAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [document, setDocument] = useState<LegalDocument>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const setConsentAcceptedAt = useStore((state) => state.setConsentAcceptedAt);

  const accept = async () => {
    if (!ageConfirmed || !documentsAccepted || saving) return;
    setSaving(true);
    try {
      const acceptedAt = new Date().toISOString();
      await saveConsentAcceptedAt(acceptedAt);
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
        Fitness Level is currently intended for people aged {MINIMUM_AGE} or older. Please confirm your age and review the draft privacy policy and terms.
      </Text>
      <TouchableOpacity
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ageConfirmed }}
        accessibilityLabel={`I confirm I am ${MINIMUM_AGE} or older`}
        accessibilityHint="Required to use the app"
        onPress={() => { setAgeConfirmed(!ageConfirmed); setDeclined(false); }}
      >
        <Text style={styles.checkText}>{ageConfirmed ? '☑' : '☐'} I confirm I am {MINIMUM_AGE} or older</Text>
      </TouchableOpacity>
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
        style={[styles.primaryButton, (!ageConfirmed || !documentsAccepted || saving) && styles.disabledButton]}
        accessibilityRole="button"
        accessibilityLabel="Continue to Fitness Level"
        accessibilityHint="Stores the acceptance timestamp on this device"
        accessibilityState={{ disabled: !ageConfirmed || !documentsAccepted || saving }}
        disabled={!ageConfirmed || !documentsAccepted || saving}
        onPress={accept}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue'}</Text>
      </TouchableOpacity>
      {saveError && <Text accessibilityRole="alert" style={styles.notice}>Your acknowledgement could not be saved on this device. Check that browser storage is available and try again.</Text>}
      <TouchableOpacity
        style={styles.secondaryButton}
        accessibilityRole="button"
        accessibilityLabel={`I am under ${MINIMUM_AGE}`}
        accessibilityHint="Shows why app access is blocked"
        onPress={() => setDeclined(true)}
      >
        <Text style={styles.body}>I am under {MINIMUM_AGE}</Text>
      </TouchableOpacity>
      {declined && (
        <Text accessibilityRole="alert" style={styles.notice}>
          You cannot continue because the app is currently intended for people aged {MINIMUM_AGE} or older. You may close the app.
        </Text>
      )}
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
  secondaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing(1) },
  notice: { color: colors.warning, fontSize: 16, lineHeight: 24, marginTop: spacing(1) },
});
