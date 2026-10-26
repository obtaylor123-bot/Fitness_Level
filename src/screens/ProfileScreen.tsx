// src/screens/ProfileScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  Image,
  Linking,
  Modal,
  AppState,
} from 'react-native';
import { useStore } from '../store';
import * as Notifications from 'expo-notifications';
import { colors, spacing } from '../theme';
import { deleteAllUserData, executeSql } from '../db/database';
import { isGoogleSignInConfigured, promptGoogleSignIn } from '../services/authService';
import { BUSINESS_DETAILS } from '../config/business';
import LegalDocumentModal, { LegalDocument } from '../components/LegalDocumentModal';
import TouchableOpacity from '../components/AccessibleTouchable';

export default function ProfileScreen() {
  const { user, setUser, clearUser, setConsentAcceptedAt } = useStore();
  const [notificationTime, setNotificationTime] = useState<string>('08:00');
  const [currentWeight, setCurrentWeight] = useState<string>('');
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [loading, setLoading] = useState(false);
  const [showReminderExplanation, setShowReminderExplanation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [document, setDocument] = useState<LegalDocument>(null);
  const [weightTrackingEnabled, setWeightTrackingEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unavailable'>('undetermined');

  // Sync state with store profile
  useEffect(() => {
    if (user) {
      setNotificationTime(user.notificationTime ?? '08:00');
      setCurrentWeight(user.currentWeight ? user.currentWeight.toString() : '');
      setTargetWeight(user.targetWeight ? user.targetWeight.toString() : '');
      setWeightUnit(user.weightUnit || 'lbs');
      setWeightTrackingEnabled(user.currentWeight !== undefined || user.targetWeight !== undefined);
    }
  }, [user]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setNotificationPermission('unavailable');
      return;
    }
    const refreshPermission = async () => {
      try {
        const result = await Notifications.getPermissionsAsync();
        setNotificationPermission(result.status === 'granted' ? 'granted' : result.status === 'denied' ? 'denied' : 'undetermined');
      } catch {
        setNotificationPermission('unavailable');
      }
    };
    void refreshPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => subscription.remove();
  }, []);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const googleUser = await promptGoogleSignIn();
      if (googleUser && user) {
        const updated = {
          ...user,
          email: googleUser.email,
          displayName: googleUser.name,
          photoUrl: googleUser.photoUrl,
          authProvider: 'google' as const,
        };

        await executeSql(
          `UPDATE user_profile SET email = ?, displayName = ?, photoUrl = ?, authProvider = ? WHERE id = ?;`,
          [
            updated.email,
            updated.displayName,
            updated.photoUrl,
            updated.authProvider,
            user.id,
          ]
        );
        setUser(updated);
        Alert.alert('Signed In', `Welcome back, ${googleUser.name}!`);
      } else if (!isGoogleSignInConfigured()) {
        Alert.alert('Google sign-in unavailable', 'Google sign-in requires app credentials to be configured.');
      }
    } catch (e) {
      Alert.alert('Sign-In Error', 'Could not sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearWeightData = async () => {
    if (!user) return;
    await executeSql('UPDATE user_profile SET currentWeight = NULL, targetWeight = NULL WHERE id = ?;', [user.id]);
    setCurrentWeight('');
    setTargetWeight('');
    setWeightTrackingEnabled(false);
    setUser({ ...user, currentWeight: undefined, targetWeight: undefined });
  };

  const scheduleReminder = async (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: '🏋️ Ready for today’s workout?', body: 'Open Fitness Level for today’s set.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
  };

  const enableReminder = async () => {
    setShowReminderExplanation(false);
    if (!user || Platform.OS === 'web') {
      Alert.alert('Reminder unavailable', 'Workout reminders are available in the iOS and Android app.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(notificationTime)) {
      Alert.alert('Invalid time', 'Set a valid reminder time before enabling reminders.');
      return;
    }
    const [hour, minute] = notificationTime.split(':').map(Number);
    if (hour > 23 || minute > 59) {
      Alert.alert('Invalid time', 'Set a valid reminder time before enabling reminders.');
      return;
    }
    try {
      const permission = await Notifications.getPermissionsAsync();
      const result = permission.status === 'granted'
        ? permission
        : await Notifications.requestPermissionsAsync();
      if (result.status !== 'granted') {
        setNotificationPermission('denied');
        Alert.alert(
          'Notifications are off',
          'Enable notifications in system settings to receive your local workout reminder.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ]
        );
        return;
      }
      setNotificationPermission('granted');
      await scheduleReminder(notificationTime);
      await executeSql('UPDATE user_profile SET notificationsEnabled = 1 WHERE id = ?;', [user.id]);
      setUser({ ...user, notificationsEnabled: true });
    } catch {
      Alert.alert('Reminder unavailable', 'The reminder could not be scheduled. Check notification settings and try again.');
    }
  };

  const disableReminder = async () => {
    if (!user) return;
    try {
      if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
      await executeSql('UPDATE user_profile SET notificationsEnabled = 0 WHERE id = ?;', [user.id]);
      setUser({ ...user, notificationsEnabled: false });
    } catch {
      Alert.alert('Could not turn off reminder', 'Please try again.');
    }
  };

  const confirmDeleteData = () => {
    setShowDeleteConfirmation(true);
  };

  const deleteMyData = async () => {
    try {
      if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
      await deleteAllUserData();
      clearUser();
      setConsentAcceptedAt(null);
    } catch {
      Alert.alert('Could not delete data', 'Some local data could not be removed. Please try again.');
    }
  };

  // Google Sign-Out Handler
  const handleGoogleSignOut = async () => {
    if (!user) return;
    const updated = {
      ...user,
      email: undefined,
      displayName: undefined,
      photoUrl: undefined,
      authProvider: 'guest' as const,
    };
    await executeSql(
      `UPDATE user_profile SET email = NULL, displayName = NULL, photoUrl = NULL, authProvider = 'guest' WHERE id = ?;`,
      [user.id]
    );
    setUser(updated);
    Alert.alert('Signed Out', 'You are now browsing as a guest.');
  };

  // Save Goals & Notification settings
  const handleSaveProfile = async () => {
    if (!user) {
      Alert.alert('Error', 'User profile not loaded yet');
      return;
    }

    // Validate notification time HH:MM
    if (!/^\d{2}:\d{2}$/.test(notificationTime)) {
      Alert.alert('Invalid time', 'Please use HH:MM format (e.g. 08:30)');
      return;
    }
    const [hourStr, minuteStr] = notificationTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      Alert.alert('Invalid time', 'Hour must be 0-23 and minute 0-59');
      return;
    }

    const curWt = currentWeight.trim() ? parseFloat(currentWeight) : undefined;
    const tgtWt = targetWeight.trim() ? parseFloat(targetWeight) : undefined;

    if (curWt !== undefined && isNaN(curWt)) {
      Alert.alert('Invalid Weight', 'Current weight must be a valid number.');
      return;
    }
    if (tgtWt !== undefined && isNaN(tgtWt)) {
      Alert.alert('Invalid Weight', 'Goal weight must be a valid number.');
      return;
    }

    // Update DB
    await executeSql(
      `UPDATE user_profile SET notificationTime = ?, currentWeight = ?, targetWeight = ?, weightUnit = ?, notificationsEnabled = ? WHERE id = ?;`,
      [
        notificationTime,
        curWt !== undefined ? curWt : null,
        tgtWt !== undefined ? tgtWt : null,
        weightUnit,
        user.notificationsEnabled ? 1 : 0,
        user.id,
      ]
    );

    // Update Zustand store
    const updatedUser = {
      ...user,
      notificationTime,
      currentWeight: curWt,
      targetWeight: tgtWt,
      weightUnit,
    };
    setUser(updatedUser);

    // Update an already-enabled reminder without requesting permissions again.
    if (Platform.OS !== 'web' && user.notificationsEnabled) {
      try {
        await scheduleReminder(notificationTime);
      } catch (err) {
        console.warn('Could not reschedule notification:', err);
      }
    }

    Alert.alert('Saved', 'Your goals and preferences have been updated!');
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Loading profile…</Text>
      </View>
    );
  }

  // Weight goal calculation
  const curNum = parseFloat(currentWeight);
  const tgtNum = parseFloat(targetWeight);
  const hasWeightGoal = !isNaN(curNum) && !isNaN(tgtNum);
  const weightDiff = hasWeightGoal ? Math.abs(curNum - tgtNum) : null;
  const isGoalReached = hasWeightGoal && Math.abs(curNum - tgtNum) < 0.2;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Athlete Profile</Text>

      {/* Account / Google Auth Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {user.authProvider === 'google' && user.email ? (
          <View style={styles.accountRow}>
            {user.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.avatar} accessibilityLabel={`${user.displayName || 'Google'} profile photo`} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
                </Text>
              </View>
            )}
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>
                {user.displayName || 'Google Athlete'}
              </Text>
              <Text style={styles.accountEmail}>{user.email}</Text>
              <View style={styles.googleBadge}>
                <Text style={styles.googleBadgeText}>✓ Connected with Google</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.signOutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out of Google"
              accessibilityHint="Removes Google profile information saved in this app"
              onPress={handleGoogleSignOut}
            >
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.subtext}>
              Google sign-in is unavailable until app credentials are configured. Your profile is currently stored on this device.
            </Text>
            <TouchableOpacity
              style={styles.googleSignInBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign in with Google"
              accessibilityHint="Opens Google sign-in if app credentials are configured"
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Text style={styles.googleIconText}>G</Text>
              <Text style={styles.googleBtnText}>
                {loading ? 'Connecting...' : 'Sign in with Google'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Personal Goals: Weight Tracking Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Goals & Weight</Text>
        <Text style={styles.subtext}>
          Weight tracking is optional. Leave these fields blank if you do not want to record weight.
        </Text>
        <Text style={styles.subtext}>Weight tracking: {weightTrackingEnabled ? 'on' : 'off'}</Text>

        <View style={styles.unitRow}>
          <Text style={styles.label}>Units:</Text>
          <View style={styles.unitToggleWrap}>
            <TouchableOpacity
              style={[styles.unitBtn, weightUnit === 'lbs' && styles.unitBtnActive]}
              accessibilityRole="radio"
              accessibilityLabel="Pounds"
              accessibilityState={{ selected: weightUnit === 'lbs' }}
              onPress={() => setWeightUnit('lbs')}
            >
              <Text
                style={[
                  styles.unitBtnText,
                  weightUnit === 'lbs' && styles.unitBtnTextActive,
                ]}
              >
                Pounds (lbs)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]}
              accessibilityRole="radio"
              accessibilityLabel="Kilograms"
              accessibilityState={{ selected: weightUnit === 'kg' }}
              onPress={() => setWeightUnit('kg')}
            >
              <Text
                style={[
                  styles.unitBtnText,
                  weightUnit === 'kg' && styles.unitBtnTextActive,
                ]}
              >
                Kilograms (kg)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputsGrid}>
          <View style={styles.gridCol}>
            <Text style={styles.inputLabel}>Current Weight</Text>
            <TextInput
              style={styles.weightInput}
              keyboardType="numeric"
              placeholder={`e.g. 175`}
              placeholderTextColor="#777"
              value={currentWeight}
              onChangeText={(value) => { setCurrentWeight(value); setWeightTrackingEnabled(Boolean(value) || Boolean(targetWeight)); }}
              accessibilityLabel="Current weight"
            />
          </View>

          <View style={styles.gridCol}>
            <Text style={styles.inputLabel}>Goal Weight</Text>
            <TextInput
              style={styles.weightInput}
              keyboardType="numeric"
              placeholder={`e.g. 165`}
              placeholderTextColor="#777"
              value={targetWeight}
              onChangeText={(value) => { setTargetWeight(value); setWeightTrackingEnabled(Boolean(value) || Boolean(currentWeight)); }}
              accessibilityLabel="Goal weight"
            />
          </View>
        </View>

        {hasWeightGoal && (
          <View style={styles.goalBanner}>
            {isGoalReached ? (
              <Text style={styles.goalBannerText}>
                🏆 Goal Reached! Outstanding dedication!
              </Text>
            ) : (
              <Text style={styles.goalBannerText}>
                🎯 {weightDiff?.toFixed(1)} {weightUnit} {curNum > tgtNum ? 'to burn' : 'to build'} to achieve goal!
              </Text>
            )}
          </View>
        )}
        <TouchableOpacity
          style={styles.secondaryAction}
          accessibilityRole="button"
          accessibilityLabel="Turn off and clear weight tracking"
          accessibilityHint="Removes saved current and goal weights only"
          onPress={handleClearWeightData}
        >
          <Text style={styles.secondaryActionText}>Turn off and clear weight tracking</Text>
        </TouchableOpacity>
      </View>

      {/* Fitness Profile & Stats Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stats & Daily Reminder</Text>
        <Text style={styles.label}>Level: {user.currentLevel} (Total XP: {user.currentXP})</Text>
        <Text style={styles.label}>Current Streak: {user.currentStreak} days (Record: {user.longestStreak})</Text>
        <Text style={styles.label}>Focus Goal: {user.goal?.toUpperCase()}</Text>
        <Text style={styles.label}>Experience Tier: {user.experienceLevel}</Text>

        <View style={styles.reminderRow}>
          <Text style={styles.label}>Daily Reminder (HH:MM):</Text>
          <TextInput
            style={styles.timeInput}
            value={notificationTime}
            onChangeText={setNotificationTime}
            placeholder="08:00"
            placeholderTextColor="#777"
            accessibilityLabel="Daily workout reminder time, hours and minutes"
          />
        </View>
        <Text style={styles.subtext}>
          {user.notificationsEnabled && notificationPermission === 'granted'
            ? 'A local reminder is enabled.'
            : notificationPermission === 'denied'
              ? 'Notifications are off in system settings. Turn them on to receive workout reminders.'
              : 'Reminders are off. Enabling one asks for notification permission.'}
        </Text>
        {notificationPermission === 'denied' && Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Open notification settings" accessibilityHint="Opens the device settings for Fitness Level notifications" onPress={() => { void Linking.openSettings(); }}>
            <Text style={styles.secondaryActionText}>Open notification settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.secondaryAction}
          accessibilityRole="button"
          accessibilityLabel={user.notificationsEnabled ? 'Turn off workout reminder' : 'Enable workout reminder'}
          accessibilityHint={user.notificationsEnabled ? 'Cancels the scheduled local notification' : 'Explains the reminder before asking the system for permission'}
          onPress={() => user.notificationsEnabled ? void disableReminder() : setShowReminderExplanation(true)}
        >
          <Text style={styles.secondaryActionText}>{user.notificationsEnabled ? 'Turn off reminder' : 'Enable reminder'}</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.primarySaveBtn} accessibilityRole="button" accessibilityLabel="Save profile and goals" onPress={handleSaveProfile}>
        <Text style={styles.primarySaveBtnText}>Save Profile & Goals</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy and terms</Text>
        <TouchableOpacity style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Read Privacy Policy" onPress={() => setDocument('privacy')}>
          <Text style={styles.secondaryActionText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Read Terms of Service" onPress={() => setDocument('terms')}>
          <Text style={styles.secondaryActionText}>Terms of Service</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About / Contact</Text>
        <Text style={styles.label}>Business: {BUSINESS_DETAILS.name}</Text>
        <Text style={styles.label}>Support: {BUSINESS_DETAILS.supportEmail}</Text>
        <Text style={styles.label}>Address: {BUSINESS_DETAILS.physicalAddress}</Text>
        <Text style={styles.label}>Website: {BUSINESS_DETAILS.website}</Text>
      </View>

      <TouchableOpacity style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Delete my data" accessibilityHint="Permanently removes local profile and activity after confirmation" onPress={confirmDeleteData}>
        <Text style={styles.deleteButtonText}>Delete my data</Text>
      </TouchableOpacity>

      <LegalDocumentModal document={document} onClose={() => setDocument(null)} />
      <Modal visible={showReminderExplanation} transparent animationType="fade" onRequestClose={() => setShowReminderExplanation(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reminderDialog}>
            <Text style={styles.cardTitle}>Workout reminder</Text>
            <Text style={styles.subtext}>Fitness Level can schedule one local daily notification at {notificationTime}. It stays on this device and does not send your workout data to a server. You can turn it off at any time.</Text>
            <TouchableOpacity style={styles.primarySaveBtn} accessibilityRole="button" accessibilityLabel="Continue and request notifications" onPress={() => void enableReminder()}>
              <Text style={styles.primarySaveBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Cancel reminder setup" onPress={() => setShowReminderExplanation(false)}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showDeleteConfirmation} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirmation(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reminderDialog} accessible accessibilityViewIsModal accessibilityRole="alert" accessibilityLabel="Confirm permanent data deletion">
            <Text style={styles.cardTitle}>Delete my data?</Text>
            <Text style={styles.subtext}>This permanently deletes your local profile, workout and XP history, weight entries, reminder settings and scheduled notifications, stored Google name/email/photo, and consent record. It cannot be undone. The public exercise catalog will remain on this device.</Text>
            <TouchableOpacity style={styles.deleteButton} accessibilityRole="button" accessibilityLabel="Confirm delete my data" accessibilityHint="Permanently deletes the listed local records" onPress={() => { setShowDeleteConfirmation(false); void deleteMyData(); }}>
              <Text style={styles.deleteButtonText}>Delete my data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Cancel data deletion" onPress={() => setShowDeleteConfirmation(false)}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing(2),
    paddingBottom: spacing(6),
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing(2),
    textAlign: 'center',
    marginTop: spacing(4),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing(2),
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing(1),
  },
  subtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing(1.5),
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing(0.8),
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing(1),
    flexWrap: 'wrap',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing(1.5),
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing(1.5),
  },
  avatarInitials: {
    color: colors.textOnAccent,
    fontWeight: 'bold',
    fontSize: 18,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  accountEmail: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  googleBadge: {
    backgroundColor: '#1E3A2F',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  googleBadgeText: {
    color: colors.accentSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    backgroundColor: '#3A3A48',
    paddingVertical: spacing(0.8),
    paddingHorizontal: spacing(1.5),
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  signOutBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing(1.2),
    borderRadius: 8,
    marginTop: spacing(1),
    minHeight: 48,
  },
  googleIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.googleBlue,
    marginRight: spacing(1),
  },
  googleBtnText: {
    color: '#1F1F1F',
    fontWeight: 'bold',
    fontSize: 15,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing(1.5),
    flexWrap: 'wrap',
  },
  unitToggleWrap: {
    flexDirection: 'row',
    marginLeft: spacing(1),
  },
  unitBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1.2),
    borderRadius: 6,
    marginRight: spacing(1),
    minHeight: 44,
    justifyContent: 'center',
  },
  unitBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  unitBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  unitBtnTextActive: {
    color: colors.textOnAccent,
  },
  inputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  gridCol: {
    flex: 1,
    marginRight: spacing(1),
    flexBasis: '45%',
  },
  inputLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  weightInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#16161D',
    color: colors.textPrimary,
    borderRadius: 6,
    paddingVertical: spacing(0.8),
    paddingHorizontal: spacing(1.2),
    fontSize: 16,
    fontWeight: '600',
    minHeight: 44,
  },
  goalBanner: {
    backgroundColor: '#1E2D2F',
    borderLeftWidth: 3,
    borderLeftColor: colors.accentSecondary,
    padding: spacing(1),
    borderRadius: 4,
    marginTop: spacing(0.5),
  },
  goalBannerText: {
    color: colors.accentSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing(1.5),
    flexWrap: 'wrap',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#16161D',
    color: colors.textPrimary,
    borderRadius: 6,
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1),
    marginLeft: spacing(1),
    minWidth: 70,
    textAlign: 'center',
    fontWeight: '600',
    minHeight: 44,
    fontSize: 16,
  },
  primarySaveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing(1.5),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing(1),
    minHeight: 48,
  },
  primarySaveBtnText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  info: {
    color: colors.textSecondary,
  },
  secondaryAction: { minHeight: 44, justifyContent: 'center', paddingVertical: spacing(0.5) },
  secondaryActionText: { color: colors.link, fontSize: 15, textDecorationLine: 'underline' },
  deleteButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: 8, marginVertical: spacing(1) },
  deleteButtonText: { color: colors.danger, fontSize: 16, fontWeight: 'bold' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: '#000000AA', padding: spacing(2) },
  reminderDialog: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing(2) },
});
