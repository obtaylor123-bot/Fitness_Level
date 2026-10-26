// src/screens/OnboardingFlow.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { colors, spacing } from '../theme';
import { executeSql } from '../db/database';
import { useStore } from '../store';
import { generateUUID as uuidv4 } from '../utils/uuid';

import { isGoogleSignInConfigured, promptGoogleSignIn } from '../services/authService';
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
  const { setUser } = useStore();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('strength');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [experience, setExperience] = useState('beginner');

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const [googleUser, setGoogleUser] = useState<any>(null);

  const handleGoogleSignIn = async () => {
    try {
      const gUser = await promptGoogleSignIn();
      if (gUser) {
        setGoogleUser(gUser);
        Alert.alert('Google Connected', `Signed in as ${gUser.name}`);
      } else if (!isGoogleSignInConfigured()) {
        Alert.alert('Google sign-in unavailable', 'You can continue as a guest. Google sign-in requires app credentials to be configured.');
      }
    } catch {
      Alert.alert('Error', 'Google Sign-In failed');
    }
  };

  const finish = async () => {
    const userId = uuidv4();
    const profile = {
      id: userId,
      goal,
      equipmentAvailable: equipment,
      experienceLevel: experience,
      currentXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      longestStreak: 0,
      joinDate: new Date().toISOString(),
      notificationTime: '08:00',
      email: googleUser?.email,
      displayName: googleUser?.name,
      photoUrl: googleUser?.photoUrl,
      authProvider: googleUser ? ('google' as const) : ('guest' as const),
    };
    try {
      await executeSql(
        `INSERT INTO user_profile (id, goal, equipmentAvailable, experienceLevel, currentXP, currentLevel, currentStreak, longestStreak, joinDate, notificationTime, email, displayName, photoUrl, authProvider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          profile.id,
          profile.goal,
          JSON.stringify(profile.equipmentAvailable),
          profile.experienceLevel,
          profile.currentXP,
          profile.currentLevel,
          profile.currentStreak,
          profile.longestStreak,
          profile.joinDate,
          profile.notificationTime,
          profile.email || null,
          profile.displayName || null,
          profile.photoUrl || null,
          profile.authProvider,
        ]
      );
      setUser(profile);
    } catch (e) {
      console.error('Failed to create user profile:', e);
      Alert.alert('Error', 'Failed to create profile');
    }
  };

  // Render steps
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <View style={styles.googleSection}>
              {googleUser ? (
                <View style={styles.googleConnectedBox}>
                  <Text style={styles.googleConnectedText}>
                    ✓ Connected as {googleUser.name} ({googleUser.email})
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.googleBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Quick sign in with Google"
                  accessibilityHint="Opens Google sign-in if credentials are configured; you can also continue as a guest"
                  onPress={handleGoogleSignIn}
                >
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Quick Sign in with Google</Text>
                </TouchableOpacity>
              )}
            </View>

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
  googleSection: {
    marginBottom: spacing(2),
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing(1.2),
    borderRadius: 6,
    minHeight: 48,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.googleBlue,
    marginRight: spacing(1),
  },
  googleBtnText: {
    color: '#1F1F1F',
    fontWeight: 'bold',
    fontSize: 14,
  },
  googleConnectedBox: {
    backgroundColor: '#1E3A2F',
    padding: spacing(1),
    borderRadius: 6,
    alignItems: 'center',
  },
  googleConnectedText: {
    color: colors.accentSecondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
});
