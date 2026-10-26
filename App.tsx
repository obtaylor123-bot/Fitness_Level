// App.tsx

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import TodayScreen from './src/screens/TodayScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OnboardingFlow from './src/screens/OnboardingFlow';
import ConsentScreen from './src/screens/ConsentScreen';
import * as Notifications from 'expo-notifications';
import { colors } from './src/theme';
import { useStore } from './src/store';
import { rehydrateStore } from './src/store/persist';

const Tab = createBottomTabNavigator();

export default function App() {
  const { user } = useStore();
  const { hydrated, consentAcceptedAt } = useStore();

  // Restore a reminder only when it was explicitly enabled. Never ask permission on launch.
  useEffect(() => {
    (async () => {
      if (!hydrated || Platform.OS === 'web' || !user?.notificationsEnabled) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        await Notifications.cancelAllScheduledNotificationsAsync();
        const notifTime = user.notificationTime ?? '08:00';
        const [hourStr, minuteStr] = notifTime.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🏋️‍♂️ Ready for today’s workout?',
            body: 'Open Fitness Level and earn XP!',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
        });
      } catch (err) {
        console.warn('Notifications not supported or permission denied:', err);
      }
    })();
  }, [hydrated]);

  // Load persisted data on launch
  useEffect(() => {
    rehydrateStore();
  }, []);

  // Show onboarding until a profile exists
  if (!hydrated) {
    return null;
  }

  if (!consentAcceptedAt) {
    return <ConsentScreen />;
  }

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
