import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LegacyLocalData, clearLegacyLocalUserData, readLegacyLocalUserData } from '../db/database';
import { DailySet } from '../models/DailySet';
import { UserProfile } from '../models/UserProfile';
import { useStore } from '../store';
import { getConsentAcceptedAt, importXpTransactions, saveDailySet, saveUserProfile } from '../services/userData';
import { requireSupabase } from '../services/supabase';
import { generateUUID } from '../utils/uuid';
import { colors, spacing } from '../theme';
import TouchableOpacity from '../components/AccessibleTouchable';

function stringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : ['bodyweight'];
  } catch {
    return ['bodyweight'];
  }
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeSet(row: any, userId: string): DailySet {
  let exercises: any[] = [];
  try {
    exercises = typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises;
  } catch {
    exercises = [];
  }
  return {
    id: validUuid(row.id) ? row.id : generateUUID(),
    userId,
    date: String(row.date).slice(0, 10),
    exercises: Array.isArray(exercises) ? exercises : [],
    totalXpAvailable: Math.max(0, Number(row.totalXpAvailable ?? row.total_xp_available) || 0),
    totalXpEarned: Math.max(0, Number(row.totalXpEarned ?? row.total_xp_earned) || 0),
    completedAt: row.completedAt ?? row.completed_at ?? undefined,
  };
}

export default function LegacyImportScreen() {
  const authUserId = useStore((state) => state.authUserId);
  const setUser = useStore((state) => state.setUser);
  const setLegacyImportAvailable = useStore((state) => state.setLegacyImportAvailable);
  const setConsentAcceptedAt = useStore((state) => state.setConsentAcceptedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmFresh, setConfirmFresh] = useState(false);

  const importData = async () => {
    if (!authUserId || busy) return;
    setBusy(true);
    setError('');
    try {
      const legacy: LegacyLocalData = await readLegacyLocalUserData();
      if (!legacy.profile) throw new Error('No saved local profile was found.');
      const { data: { user: authUser }, error: authError } = await requireSupabase().auth.getUser();
      if (authError || !authUser) throw new Error('Your sign-in session could not be verified. Please sign in again.');

      const old = legacy.profile;
      const provider = authUser.app_metadata.provider;
      const profile: UserProfile = {
        id: authUserId,
        goal: ['strength', 'cardio', 'mobility', 'general'].includes(old.goal) ? old.goal : 'general',
        equipmentAvailable: stringArray(old.equipmentAvailable ?? old.equipment_available),
        experienceLevel: ['beginner', 'intermediate', 'expert'].includes(old.experienceLevel) ? old.experienceLevel : 'beginner',
        currentXP: Math.max(0, Number(old.currentXP) || 0),
        currentLevel: Math.max(1, Number(old.currentLevel) || 1),
        currentStreak: Math.max(0, Number(old.currentStreak) || 0),
        longestStreak: Math.max(0, Number(old.longestStreak) || 0),
        joinDate: old.joinDate || new Date().toISOString(),
        notificationTime: old.notificationTime || '08:00',
        notificationsEnabled: Boolean(old.notificationsEnabled),
        currentWeight: Number(old.currentWeight) > 0 ? Number(old.currentWeight) : undefined,
        targetWeight: Number(old.targetWeight) > 0 ? Number(old.targetWeight) : undefined,
        weightUnit: old.weightUnit === 'kg' ? 'kg' : 'lbs',
        email: authUser.email,
        displayName: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name,
        photoUrl: authUser.user_metadata?.avatar_url,
        authProvider: provider === 'google' ? 'google' : 'email',
      };
      const consentAt = await getConsentAcceptedAt(authUserId);
      if (!consentAt) throw new Error('Review and acknowledge the current Privacy Policy and Terms before importing.');

      await saveUserProfile(profile);
      for (const row of legacy.dailySets) {
        if (!row.date) continue;
        await saveDailySet(normalizeSet(row, authUserId));
      }
      await importXpTransactions(authUserId, legacy.xpTransactions);
      await clearLegacyLocalUserData();
      setConsentAcceptedAt(consentAt);
      setUser(profile);
      setLegacyImportAvailable(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed. Your original local data is still available; please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startFresh = async () => {
    if (!confirmFresh) {
      setConfirmFresh(true);
      return;
    }
    try {
      await clearLegacyLocalUserData();
      setLegacyImportAvailable(false);
    } catch {
      Alert.alert('Could not clear old data', 'Your old local data was kept. Try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Saved workouts found</Text>
        <Text style={styles.body}>This device has a profile from an earlier version of Fitness Level. Import its profile, workout history, XP, and optional weight values into the Supabase account you just signed into. The old local copy is removed only after the cloud import succeeds.</Text>
        <TouchableOpacity style={styles.primary} accessibilityRole="button" accessibilityLabel="Import my workouts from this device" accessibilityHint="Copies the old local profile and workout history into your signed-in Supabase account" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void importData()}>
          <Text style={styles.primaryText}>{busy ? 'Importing…' : 'Import my saved data'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} accessibilityRole="button" accessibilityLabel={confirmFresh ? 'Confirm start fresh and erase old local data' : 'Start fresh without importing'} accessibilityHint="Permanently removes the previous local profile, workouts, and XP from this device" disabled={busy} onPress={() => void startFresh()}>
          <Text style={styles.secondaryText}>{confirmFresh ? 'Confirm: erase old local data' : 'Start fresh'}</Text>
        </TouchableOpacity>
        {confirmFresh && <Text style={styles.warning}>This permanently erases the old profile, workout history, XP, and optional weights on this device. Tap again to confirm.</Text>}
        {error ? <Text accessibilityRole="alert" style={styles.warning}>{error}</Text> : null}
        {busy && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors.background, padding: spacing(2) },
  card: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: spacing(3), borderWidth: 1, borderColor: colors.border },
  title: { color: colors.textPrimary, fontSize: 25, fontWeight: 'bold', marginBottom: spacing(2) },
  body: { color: colors.textPrimary, fontSize: 16, lineHeight: 24 },
  primary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.accent, borderRadius: 8, marginTop: spacing(2) },
  primaryText: { color: colors.textOnAccent, fontSize: 16, fontWeight: 'bold' },
  secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing(1) },
  secondaryText: { color: colors.link, fontSize: 16, textDecorationLine: 'underline' },
  warning: { color: colors.warning, fontSize: 14, lineHeight: 20, marginTop: spacing(1) },
  spinner: { marginTop: spacing(1) },
});
