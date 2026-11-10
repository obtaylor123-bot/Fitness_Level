// src/screens/OnboardingFlow.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../theme';
import { useStore } from '../store';
import { executeSql } from '../db/database';
import { isSupabaseConfigured } from '../services/supabase';
import { saveUserProfile } from '../services/userData';
import TouchableOpacity from '../components/AccessibleTouchable';

const SelectButton = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <TouchableOpacity
    style={[styles.selectBtn, selected && styles.selectBtnActive]}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityHint={selected ? 'Currently selected' : 'Select this option'}
    accessibilityState={{ selected }}
    onPress={onPress}
  >
    <Text style={[styles.selectBtnText, selected && styles.selectBtnTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default function OnboardingFlow() {
  const { setUser, authUserId } = useStore();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('strength');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [experience, setExperience] = useState('beginner');
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const finish = async () => {
    if (!authUserId) {
      Alert.alert('Error', 'No user session found. Please go back and sign in again.');
      return;
    }
    setSaving(true);
    try {
      const profile: {
        id: string; goal: string; equipmentAvailable: string[];
        experienceLevel: string; currentXP: number; currentLevel: number;
        currentStreak: number; longestStreak: number; joinDate: string;
        notificationTime: string; notificationsEnabled: boolean;
        authProvider: 'guest' | 'google' | 'email';
      } = {
        id: authUserId,
        goal,
        equipmentAvailable: equipment,
        experienceLevel: experience,
        currentXP: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        joinDate: new Date().toISOString(),
        notificationTime: '08:00',
        notificationsEnabled: false,
        authProvider: 'guest',
      };

      if (isSupabaseConfigured) {
        // Cloud path: also check actual auth user for provider info
        try {
          const { requireSupabase } = require('../services/supabase');
          const { data: { user: authUser } } = await requireSupabase().auth.getUser();
          if (authUser) {
            const provider = authUser.app_metadata?.provider;
            profile.authProvider = authUser.is_anonymous ? 'guest'
              : provider === 'google' ? 'google'
              : 'email';
          }
        } catch {}
        await saveUserProfile(profile);
      } else {
        // Local SQLite path (guest mode)
        const equipJson = JSON.stringify(equipment);
        await executeSql(
          `INSERT OR REPLACE INTO user_profile
            (id, goal, equipmentAvailable, experienceLevel, currentXP, currentLevel,
             currentStreak, longestStreak, joinDate, notificationTime, authProvider)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            profile.id,
            profile.goal,
            equipJson,
            profile.experienceLevel,
            profile.currentXP,
            profile.currentLevel,
            profile.currentStreak,
            profile.longestStreak,
            profile.joinDate,
            profile.notificationTime,
            profile.authProvider,
          ]
        );
      }

      setUser(profile);
    } catch (err) {
      console.error('Failed to save profile:', err);
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text style={styles.title}>🎯 Fitness Goal</Text>
            <Text style={styles.subtitle}>What do you want to focus on?</Text>
            {[
              { key: 'strength', label: '💪 Strength' },
              { key: 'cardio', label: '🏃 Cardio' },
              { key: 'mobility', label: '🧘 Mobility / Flexibility' },
              { key: 'general', label: '⚡ General Fitness' },
            ].map(({ key, label }) => (
              <SelectButton key={key} label={label} selected={goal === key} onPress={() => setGoal(key)} />
            ))}
            <TouchableOpacity style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next: choose equipment" onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.title}>🏋️ Equipment</Text>
            <Text style={styles.subtitle}>What do you have access to? (choose all that apply)</Text>
            {[
              { key: 'bodyweight', label: '🤸 Bodyweight only' },
              { key: 'dumbbell', label: '🏋️ Dumbbells' },
              { key: 'barbell', label: '🪝 Barbell' },
              { key: 'kettlebell', label: '🔔 Kettlebell' },
              { key: 'machine', label: '⚙️ Gym machines' },
            ].map(({ key, label }) => (
              <SelectButton key={key} label={label} selected={equipment.includes(key)} onPress={() => toggleEquipment(key)} />
            ))}
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(1)}>
                <Text style={styles.prevBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next" onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.title}>⚡ Experience Level</Text>
            <Text style={styles.subtitle}>How experienced are you?</Text>
            {[
              { key: 'beginner', label: '🌱 Beginner' },
              { key: 'intermediate', label: '⚡ Intermediate' },
              { key: 'expert', label: '🔥 Expert' },
            ].map(({ key, label }) => (
              <SelectButton key={key} label={label} selected={experience === key} onPress={() => setExperience(key)} />
            ))}
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(2)}>
                <Text style={styles.prevBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.finishBtn, saving && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Finish setup"
                disabled={saving}
                onPress={finish}
              >
                <Text style={styles.finishBtnText}>{saving ? 'Saving...' : '✓ Let\'s Go!'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.appTitle}>Fitness Level</Text>
      <Text style={styles.stepIndicator}>Step {step} of 3</Text>
      {renderStep()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing(2.5),
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing(0.5),
  },
  stepIndicator: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing(3),
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing(0.5),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing(2),
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2),
    borderRadius: 10,
    marginBottom: spacing(1),
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  selectBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  selectBtnTextActive: { color: colors.textOnAccent },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2),
  },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(3),
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: spacing(2),
    minHeight: 48,
    justifyContent: 'center',
  },
  nextBtnText: {
    color: colors.textOnAccent,
    fontWeight: '800',
    fontSize: 15,
  },
  prevBtn: {
    backgroundColor: colors.border,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2.5),
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  prevBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  finishBtn: {
    backgroundColor: colors.accentSecondary ?? colors.accent,
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(3),
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  finishBtnText: {
    color: colors.textOnAccent,
    fontWeight: '800',
    fontSize: 15,
  },
});
