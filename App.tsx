// App.tsx

import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TodayScreen from './src/screens/TodayScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingFlow from './src/screens/OnboardingFlow';
import ConsentScreen from './src/screens/ConsentScreen';
import LoginScreen from './src/screens/LoginScreen';
import LegacyImportScreen from './src/screens/LegacyImportScreen';
import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder } from './src/services/reminders';
import { colors } from './src/theme';
import { useStore } from './src/store';
import { rehydrateStore } from './src/store/persist';
import { isSupabaseConfigured, supabase } from './src/services/supabase';
import { retryPendingDeletionCleanup } from './src/services/userData';

const Tab = createBottomTabNavigator();

export default function App() {
  const { user, authUserId, authReady, hydrated, consentAcceptedAt, legacyImportAvailable } = useStore();
  const { setAuthUserId, setAuthReady, clearUser, setConsentAcceptedAt, setHydrated, setLegacyImportAvailable } = useStore();

  useEffect(() => {
    void (async () => {
      try {
        await retryPendingDeletionCleanup();
      } catch {
        console.warn('Could not finish pending on-device account cleanup.');
      }
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn('Could not restore the sign-in session.');
        setAuthUserId(data.session?.user.id ?? null);
      }
      setAuthReady(true);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? null);
      setAuthReady(true);
      if (!session) {
        clearUser();
        setConsentAcceptedAt(null);
        setLegacyImportAvailable(false);
        setHydrated(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !authUserId) return;
    void rehydrateStore(authUserId).catch(() => undefined);
  }, [authReady, authUserId]);

  // Restore a reminder only when it was explicitly enabled. Never ask permission on launch.
  useEffect(() => {
    (async () => {
      if (!hydrated || Platform.OS === 'web' || !user?.notificationsEnabled) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const notifTime = user.notificationTime ?? '08:00';
        await scheduleDailyReminder(notifTime);
      } catch {
        console.warn('Notifications are unavailable or permission was denied.');
      }
    })();
  }, [hydrated, user?.notificationsEnabled, user?.notificationTime]);

  if (!authReady || (authUserId && !hydrated)) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (!authUserId) return <LoginScreen />;

  if (!consentAcceptedAt) {
    return <ConsentScreen />;
  }

  if (legacyImportAvailable) return <LegacyImportScreen />;

  if (!user) {
    return <OnboardingFlow />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: { backgroundColor: colors.surface },
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'alert-circle';
            if (route.name === 'Today') iconName = 'flash';
            else if (route.name === 'Progress') iconName = 'stats-chart';
            else if (route.name === 'Profile') iconName = 'person';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
