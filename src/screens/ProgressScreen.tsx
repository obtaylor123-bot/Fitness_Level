// src/screens/ProgressScreen.tsx

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useStore } from '../store';
import { colors, spacing } from '../theme';
import { getXpForLevel } from '../services/xpEngine';
import { executeSql } from '../db/database';
import { BADGES, Badge } from '../data/badges';
import TouchableOpacity from '../components/AccessibleTouchable';

interface WorkoutHistoryItem {
  id: string;
  date: string;
  exerciseCount: number;
  totalXpAvailable: number;
  totalXpEarned: number;
  completedAt?: string;
}

interface XpTransaction {
  id: string;
  date: string;
  amount: number;
  source: string;
}

export default function ProgressScreen() {
  const { user } = useStore();
  const [nextLevelXp, setNextLevelXp] = useState<number>(0);
  const [currentLevelXp, setCurrentLevelXp] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryItem[]>([]);
  const [xpLog, setXpLog] = useState<XpTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'workouts' | 'xp'>('workouts');

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // XP thresholds
      const nextXp = await getXpForLevel(user.currentLevel + 1);
      const thisXp = await getXpForLevel(user.currentLevel);
      setNextLevelXp(nextXp);
      setCurrentLevelXp(thisXp);

      // Workout history
      const setsResult = await executeSql(
        'SELECT * FROM daily_sets WHERE userId = ? ORDER BY date DESC LIMIT 30',
        [user.id]
      );
      const history: WorkoutHistoryItem[] = setsResult.rows._array.map((row: any) => {
        let exerciseCount = 0;
        try {
          const parsed = typeof row.exercises === 'string'
            ? JSON.parse(row.exercises)
            : row.exercises;
          exerciseCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {}
        return {
          id: row.id,
          date: row.date,
          exerciseCount,
          totalXpAvailable: row.totalXpAvailable ?? 0,
          totalXpEarned: row.totalXpEarned ?? 0,
          completedAt: row.completedAt,
        };
      });
      setWorkoutHistory(history);

      // XP transaction log
      const txResult = await executeSql(
        'SELECT * FROM xp_transactions WHERE userId = ? ORDER BY date DESC LIMIT 30',
        [user.id]
      );
      setXpLog(txResult.rows._array as XpTransaction[]);
    } catch (e) {
      console.warn('ProgressScreen load error:', e);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.infoText}>No user profile loaded.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // XP progress within current level
  const xpIntoLevel = Math.max(0, user.currentXP - currentLevelXp);
  const xpNeeded = Math.max(1, nextLevelXp - currentLevelXp);
  const progress = Math.min(1, xpIntoLevel / xpNeeded);
  const percent = Math.round(progress * 100);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* ── LEVEL & XP BAR ── */}
      <View style={styles.xpCard}>
        <Text style={styles.header}>⚡ Progress</Text>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>Level {user.currentLevel}</Text>
          <Text style={styles.xpText}>{user.currentXP.toLocaleString()} XP total</Text>
        </View>
        <View style={styles.barBackground}>
          <View style={[styles.barFill, { width: `${percent}%` as any }]} />
        </View>
        <View style={styles.xpRow}>
          <Text style={styles.xpSubText}>{xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP</Text>
          <Text style={styles.xpSubText}>{percent}% to Level {user.currentLevel + 1}</Text>
        </View>
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>🔥 {user.currentStreak} day streak</Text>
          <Text style={styles.streakText}>🏆 Best: {user.longestStreak} days</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Refresh progress and workout history" accessibilityHint="Reloads your saved progress from this device" accessibilityState={{ disabled: refreshing }} disabled={refreshing} onPress={() => void onRefresh()}>
          <Text style={styles.refreshButtonText}>{refreshing ? 'Refreshing…' : 'Refresh progress'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── BADGES ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <Text style={styles.sectionSub}>Unlock a badge every 5 levels</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge: Badge) => {
            const unlocked = user.currentLevel >= badge.level;
            return (
              <View key={badge.level} style={[styles.badgeCard, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                <Text style={styles.badgeIcon}>{unlocked ? badge.icon : '🔒'}</Text>
                <Text style={[styles.badgeName, !unlocked && styles.badgeLockedText]} numberOfLines={1}>
                  {badge.name}
                </Text>
                <Text style={[styles.badgeLevel, !unlocked && styles.badgeLockedText]}>
                  Lv {badge.level}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── HISTORY TABS ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'workouts' && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel="Workout history"
            accessibilityState={{ selected: activeTab === 'workouts' }}
            accessibilityHint="Shows the recent workout history"
            onPress={() => setActiveTab('workouts')}
          >
            <Text style={[styles.tabText, activeTab === 'workouts' && styles.tabTextActive]}>
              Workouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'xp' && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityLabel="XP log"
            accessibilityState={{ selected: activeTab === 'xp' }}
            accessibilityHint="Shows recent experience point activity"
            onPress={() => setActiveTab('xp')}
          >
            <Text style={[styles.tabText, activeTab === 'xp' && styles.tabTextActive]}>
              XP Log
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'workouts' && (
          workoutHistory.length === 0 ? (
            <Text style={styles.emptyText}>No workouts yet. Complete your first set to see history!</Text>
          ) : (
            workoutHistory.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
                  <Text style={styles.historyDetail}>
                    {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
                    {item.completedAt ? ' ✓' : ' (partial)'}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyXp}>+{item.totalXpEarned} XP</Text>
                  <Text style={styles.historyXpSub}>of {item.totalXpAvailable} available</Text>
                </View>
              </View>
            ))
          )
        )}

        {activeTab === 'xp' && (
          xpLog.length === 0 ? (
            <Text style={styles.emptyText}>No XP earned yet. Complete a workout to start!</Text>
          ) : (
            xpLog.map((tx) => (
              <View key={tx.id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>{formatDate(tx.date)}</Text>
                  <Text style={styles.historyDetail}>{tx.source || 'workout'}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyXp}>+{tx.amount} XP</Text>
                </View>
              </View>
            ))
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing(2),
    paddingBottom: spacing(4),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 16,
  },

  // XP card
  xpCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: spacing(2),
    marginBottom: spacing(2),
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  refreshButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, marginTop: spacing(1) },
  refreshButtonText: { color: colors.link, fontSize: 14, textDecorationLine: 'underline' },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: spacing(1.5),
    textAlign: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(1),
  },
  levelText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  xpText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  barBackground: {
    width: '100%',
    height: 18,
    backgroundColor: '#333',
    borderRadius: 9,
    overflow: 'hidden',
    marginVertical: spacing(1),
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 9,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpSubText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing(1.5),
    paddingTop: spacing(1),
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  streakText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: spacing(2),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing(1.5),
  },

  // Badge grid
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    width: '47%',
    minHeight: 112,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderWidth: 1,
  },
  badgeUnlocked: {
    backgroundColor: '#1a2a1a',
    borderColor: colors.accent + '88',
  },
  badgeLocked: {
    backgroundColor: '#1a1a1a',
    borderColor: '#333',
  },
  badgeIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  badgeName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  badgeLevel: {
    fontSize: 13,
    color: colors.accent,
    marginTop: 1,
  },
  badgeLockedText: {
    color: '#555',
  },

  // History tabs
  tabRow: {
    flexDirection: 'row',
    marginBottom: spacing(1.5),
    backgroundColor: '#111',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnAccent,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing(2),
    fontSize: 14,
    lineHeight: 22,
  },

  // History cards
  historyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    padding: spacing(1.5),
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  historyDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyXp: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.accent,
  },
  historyXpSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
