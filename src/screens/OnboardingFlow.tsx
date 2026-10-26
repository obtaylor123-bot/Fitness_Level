// src/screens/OnboardingFlow.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../theme';
import { useStore } from '../store';
import { saveUserProfile } from '../services/userData';
import { requireSupabase } from '../services/supabase';
import TouchableOpacity from '../components/AccessibleTouchable';

// Simple selectable button component
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

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const finish = async () => {
    if (!authUserId) {
      Alert.alert('Sign in required', 'Return to the login screen and try again.');
      return;
    }
    const { data: { user: authUser }, error: authError } = await requireSupabase().auth.getUser();
    if (authError || !authUser) {
      Alert.alert('Sign in required', 'Your login session could not be verified. Please sign in again.');
      return;
    }
    const provider = authUser.app_metadata.provider;
    const profile = {
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
      email: authUser.email,
      displayName: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name,
      photoUrl: authUser.user_metadata?.avatar_url,
      authProvider: (authUser.is_anonymous ? 'guest' : provider === 'google' ? 'google' : 'email') as 'guest' | 'google' | 'email',
    };
    try {
      await saveUserProfile(profile);
      setUser(profile);
    } catch {
      console.error('Failed to create user profile.');
      Alert.alert('Error', 'Failed to create profile');
    }
  };

  // Render steps
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text style={styles.accountNotice}>Your sign-in is ready. Set up your workout profile.</Text>
            <Text style={styles.title}>Select your fitness goal</Text>
            {['strength', 'cardio', 'mobility', 'general'].map((g) => (
              <SelectButton
                key={g}
                label={g.charAt(0).toUpperCase() + g.slice(1)}
                selected={goal === g}
                onPress={() => setGoal(g)}
              />
            ))}
            <TouchableOpacity style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next: choose equipment" onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.title}>Select available equipment</Text>
            {['bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'machine'].map((eq) => (
              <SelectButton
                key={eq}
                label={eq}
                selected={equipment.includes(eq)}
                onPress={() => toggleEquipment(eq)}
              />
            ))}
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} accessibilityRole="button" accessibilityLabel="Back to fitness goal" onPress={() => setStep(1)}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Next: choose experience level" onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.title}>Experience level</Text>
            {['beginner', 'intermediate', 'expert'].map((lvl) => (
              <SelectButton
                key={lvl}
                label={lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                selected={experience === lvl}
                onPress={() => setExperience(lvl)}
              />
            ))}
            <View style={styles.navRow}>
              <TouchableOpacity style={styles.prevBtn} accessibilityRole="button" accessibilityLabel="Back to equipment" onPress={() => setStep(2)}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishBtn} accessibilityRole="button" accessibilityLabel="Finish profile setup" onPress={finish}>
                <Text style={styles.finishBtnText}>Finish</Text>
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
      {renderStep()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing(2),
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing(2),
    textAlign: 'center',
  },
  selectBtn: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    borderRadius: 4,
    marginBottom: spacing(1),
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  selectBtnActive: {
    backgroundColor: colors.accent,
  },
  selectBtnText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  selectBtnTextActive: { color: colors.textOnAccent },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2),
  },
  nextBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: spacing(2),
    minHeight: 44,
    justifyContent: 'center',
  },
  nextBtnText: {
    color: colors.textOnAccent,
    fontWeight: 'bold',
  },
  prevBtn: {
    backgroundColor: colors.textSecondary,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
    borderRadius: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  prevBtnText: {
    color: colors.textOnAccent,
    fontWeight: 'bold',
  },
  finishBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(3),
    borderRadius: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  finishBtnText: {
    color: colors.textOnAccent,
    fontWeight: 'bold',
  },
  accountNotice: { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing(2) },
});
