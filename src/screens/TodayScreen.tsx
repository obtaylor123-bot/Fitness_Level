// src/screens/TodayScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useStore } from '../store';
import { generateDailySet } from '../services/dailySetGenerator';
import { DailyExerciseEntry } from '../models/DailySet';
import { colors, spacing } from '../theme';
import { getLevelForXp, recordXpTransaction } from '../services/xpEngine';
import { executeSql } from '../db/database';
import TouchableOpacity from '../components/AccessibleTouchable';

export default function TodayScreen() {
  const { user, dailySet, setDailySet, setUser } = useStore();
  const [loading, setLoading] = useState(false);

  // Preference edit modal state
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState('strength');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState('beginner');

  // Initialize preference states from user profile
  useEffect(() => {
    if (user) {
      setSelectedGoal(user.goal || 'strength');
      setSelectedEquipment(
        Array.isArray(user.equipmentAvailable)
          ? user.equipmentAvailable
          : []
      );
      setSelectedLevel(user.experienceLevel || 'beginner');
    }
  }, [user]);

  // Initialize daily set on mount if needed
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      if (!dailySet) {
        setLoading(true);
        try {
          const set = await generateDailySet(user.id);
          setDailySet(set);
        } catch (e) {
          console.error('Error generating daily set:', e);
        } finally {
          setLoading(false);
        }
      }
    };
    init();
  }, [user, dailySet]);

  const persistDailySet = async (updatedSet: typeof dailySet) => {
    if (!updatedSet) return;
    await executeSql(
      `UPDATE daily_sets SET exercises = ?, totalXpEarned = ? WHERE id = ?;`,
      [JSON.stringify(updatedSet.exercises), updatedSet.totalXpEarned, updatedSet.id]
    );
    setDailySet(updatedSet);
  };

  const handleRegenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const set = await generateDailySet(user.id);
      setDailySet(set);
      Alert.alert('Updated', 'Generated a new workout routine!');
    } catch (e) {
      console.error('Error regenerating daily set:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEquipmentItem = (item: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedUser = {
        ...user,
        goal: selectedGoal,
        equipmentAvailable: selectedEquipment,
        experienceLevel: selectedLevel,
      };

      await executeSql(
        `UPDATE user_profile SET goal = ?, equipmentAvailable = ?, experienceLevel = ? WHERE id = ?;`,
        [
          updatedUser.goal,
          JSON.stringify(updatedUser.equipmentAvailable),
          updatedUser.experienceLevel,
          user.id,
        ]
      );
      setUser(updatedUser);

      // Immediately generate a new workout matching the new preferences
      const newSet = await generateDailySet(user.id);
      setDailySet(newSet);
      setShowPreferences(false);
      Alert.alert('Success', 'Preferences updated and new workout generated!');
    } catch (e) {
      console.error('Failed to update preferences:', e);
      Alert.alert('Error', 'Could not save preferences.');
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseComplete = async (exerciseId: string) => {
    if (!user || !dailySet) return;
    const entryIndex = dailySet.exercises.findIndex(
      (e: DailyExerciseEntry) => e.exerciseId === exerciseId
    );
    if (entryIndex === -1) return;
    const entry = dailySet.exercises[entryIndex];
    if (entry.completed) {
      Alert.alert('Info', 'Exercise already completed');
      return;
    }

    const baseXP = entry.xpValue;
    const earnedXP = baseXP;
    const newXP = (user.currentXP ?? 0) + earnedXP;
    const newLevel = await getLevelForXp(newXP);
    const newStreak = (user.currentStreak ?? 0) + 1;
    const longestStreak = Math.max(user.longestStreak ?? 0, newStreak);

    await executeSql(
      `UPDATE user_profile SET currentXP = ?, currentLevel = ?, currentStreak = ?, longestStreak = ? WHERE id = ?;`,
      [newXP, newLevel, newStreak, longestStreak, user.id]
    );
    const updatedUser = {
      ...user,
      currentXP: newXP,
      currentLevel: newLevel,
      currentStreak: newStreak,
      longestStreak,
    };
    setUser(updatedUser);

    await recordXpTransaction(user.id, earnedXP, `exercise_${exerciseId}`);

    const updatedEntry = { ...entry, completed: true };
    const newExercises = [...dailySet.exercises];
    newExercises[entryIndex] = updatedEntry;
    const newEarned = (dailySet.totalXpEarned ?? 0) + earnedXP;
    const updatedSet = { ...dailySet, exercises: newExercises, totalXpEarned: newEarned };
    await persistDailySet(updatedSet);
    Alert.alert('Great job!', `Earned +${earnedXP} XP!`);
  };

  const getLevelBadge = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'expert':
        return { bg: '#3D1B28', border: '#FF4757', text: '#FF6B81', icon: '⚡⚡⚡' };
      case 'intermediate':
        return { bg: '#362E1B', border: '#FFA502', text: '#FFC048', icon: '⚡⚡' };
      case 'beginner':
      default:
        return { bg: '#183324', border: '#2ED573', text: '#7BED9F', icon: '⚡' };
    }
  };

  const renderItem = ({ item }: { item: DailyExerciseEntry }) => {
    const levelInfo = getLevelBadge(item.level);

    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.name || item.exerciseId.replace(/_/g, ' ')}</Text>
        <View style={styles.tagRow}>
          {item.level ? (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: levelInfo.bg,
                  borderColor: levelInfo.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.tagText, { color: levelInfo.text }]}>
                {levelInfo.icon} {item.level}
              </Text>
            </View>
          ) : null}
          {item.equipment ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>🏋️ {item.equipment}</Text>
            </View>
          ) : null}
          {item.category ? (
            <View style={[styles.tag, styles.catTag]}>
              <Text style={styles.tagText}>🎯 {item.category}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.detail}>
          Sets: {item.targetSets}   Reps: {item.targetReps || 'To Failure'}   XP: +{item.xpValue}
        </Text>
        <TouchableOpacity
          style={[styles.completeBtn, item.completed && styles.doneBtn]}
          accessibilityRole="button"
          accessibilityLabel={item.completed ? `${item.name || item.exerciseId}, completed` : `Mark ${item.name || item.exerciseId.replace(/_/g, ' ')} done and earn ${item.xpValue} XP`}
          accessibilityHint={item.completed ? undefined : 'Marks this exercise complete and updates your workout progress'}
          accessibilityState={{ disabled: item.completed }}
          onPress={() => handleExerciseComplete(item.exerciseId)}
          disabled={item.completed}
        >
          <Text style={[styles.btnText, !item.completed && styles.btnTextOnAccent]}>{item.completed ? '✓ Completed' : 'Mark Done (+XP)'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Today's Workout</Text>

      {/* Action buttons to change preferences or regenerate */}
      <View style={styles.topActionsRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel="Edit workout preferences"
          accessibilityHint="Choose workout goal, available equipment, and experience level"
          onPress={() => setShowPreferences(true)}
        >
          <Text style={styles.actionBtnText}>⚙️ Edit Preferences</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.regenerateBtn]}
          accessibilityRole="button"
          accessibilityLabel="Generate a different workout"
          accessibilityHint="Replaces today's suggested workout"
          onPress={handleRegenerate}
        >
          <Text style={styles.actionBtnText}>🔄 Re-roll Workout</Text>
        </TouchableOpacity>
      </View>

      {loading || !dailySet ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.detail, { marginTop: spacing(1) }]}>
            Updating workout...
          </Text>
        </View>
      ) : (
        <FlatList
          data={dailySet.exercises}
          keyExtractor={(item) => item.exerciseId}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing(4) }}
        />
      )}

      {/* Edit Workout Preferences Modal */}
      <Modal
        visible={showPreferences}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPreferences(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing(2) }}>
              <Text style={styles.modalTitle}>Workout Preferences</Text>

              <Text style={styles.sectionHeader}>Goal</Text>
              <View style={styles.optionsWrap}>
                {['strength', 'cardio', 'mobility', 'general'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.choiceBtn,
                      selectedGoal === g && styles.choiceBtnActive,
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${g} workout goal`}
                    accessibilityState={{ selected: selectedGoal === g }}
                    accessibilityHint={selectedGoal === g ? 'Selected' : 'Select this goal'}
                    onPress={() => setSelectedGoal(g)}
                  >
                    <Text
                      style={[
                        styles.choiceBtnText,
                        selectedGoal === g && styles.choiceBtnTextActive,
                      ]}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionHeader}>Available Equipment</Text>
              <View style={styles.optionsWrap}>
                {['bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'machine'].map(
                  (eq) => (
                    <TouchableOpacity
                      key={eq}
                      style={[
                        styles.choiceBtn,
                        selectedEquipment.includes(eq) && styles.choiceBtnActive,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${eq} equipment`}
                      accessibilityState={{ checked: selectedEquipment.includes(eq) }}
                      accessibilityHint="Select or clear this equipment option"
                      onPress={() => toggleEquipmentItem(eq)}
                    >
                      <Text
                        style={[
                          styles.choiceBtnText,
                          selectedEquipment.includes(eq) && styles.choiceBtnTextActive,
                        ]}
                      >
                        {eq.charAt(0).toUpperCase() + eq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <Text style={styles.sectionHeader}>Experience Level</Text>
              <View style={styles.optionsWrap}>
                {['beginner', 'intermediate', 'expert'].map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.choiceBtn,
                      selectedLevel === lvl && styles.choiceBtnActive,
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${lvl} experience level`}
                    accessibilityState={{ selected: selectedLevel === lvl }}
                    accessibilityHint={selectedLevel === lvl ? 'Selected' : 'Select this level'}
                    onPress={() => setSelectedLevel(lvl)}
                  >
                    <Text
                      style={[
                        styles.choiceBtnText,
                        selectedLevel === lvl && styles.choiceBtnTextActive,
                      ]}
                    >
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel preference changes"
                  onPress={() => setShowPreferences(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.savePrefBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Save preferences and generate workout"
                  onPress={handleSavePreferences}
                >
                  <Text style={[styles.btnText, styles.btnTextOnAccent]}>Save & Generate</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing(2),
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing(1.5),
    textAlign: 'center',
    marginTop: spacing(4),
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing(2),
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1),
    borderRadius: 8,
    marginHorizontal: spacing(0.5),
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  regenerateBtn: {
    borderColor: colors.accent,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing(0.5),
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing(1),
  },
  tag: {
    backgroundColor: '#2A2A38',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 6,
    marginTop: 2,
  },
  catTag: {
    backgroundColor: '#1E2D2F',
  },
  tagText: {
    color: colors.accentSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detail: {
    color: colors.textSecondary,
    marginBottom: spacing(1.5),
  },
  completeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(2),
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  doneBtn: {
    backgroundColor: '#3A3A48',
  },
  btnText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  btnTextOnAccent: { color: colors.textOnAccent },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing(2),
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing(2.5),
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing(2),
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: spacing(1.5),
    marginBottom: spacing(1),
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing(1),
  },
  choiceBtn: {
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingVertical: spacing(0.8),
    paddingHorizontal: spacing(1.5),
    borderRadius: 6,
    marginRight: spacing(1),
    marginBottom: spacing(1),
    minHeight: 44,
    justifyContent: 'center',
  },
  choiceBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  choiceBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  choiceBtnTextActive: {
    color: colors.textOnAccent,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2.5),
  },
  cancelBtn: {
    backgroundColor: '#3A3A48',
    paddingVertical: spacing(1.2),
    paddingHorizontal: spacing(2.5),
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  savePrefBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(1.2),
    paddingHorizontal: spacing(2.5),
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
});
