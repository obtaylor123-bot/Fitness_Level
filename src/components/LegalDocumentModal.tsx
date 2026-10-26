import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import TouchableOpacity from './AccessibleTouchable';
import { colors, spacing } from '../theme';
import { PRIVACY_POLICY } from '../legal/privacyPolicy';
import { TERMS_OF_SERVICE } from '../legal/termsOfService';

export type LegalDocument = 'privacy' | 'terms' | null;

export default function LegalDocumentModal({
  document,
  onClose,
}: {
  document: LegalDocument;
  onClose: () => void;
}) {
  const title = document === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const content = document === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <Modal visible={document !== null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView accessibilityLabel={`${title} document`}>
          <Text selectable style={styles.content}>{content}</Text>
        </ScrollView>
        <TouchableOpacity
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          accessibilityHint="Returns to the previous screen"
          onPress={onClose}
        >
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(2) },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: 'bold', marginVertical: spacing(1) },
  content: { color: colors.textPrimary, fontSize: 16, lineHeight: 24, paddingVertical: spacing(1) },
  closeButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: spacing(1) },
  closeText: { color: colors.textOnAccent, fontSize: 16, fontWeight: 'bold' },
});
