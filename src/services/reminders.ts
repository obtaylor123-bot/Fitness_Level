import * as Notifications from 'expo-notifications';

export function isValidReminderTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hour, minute] = time.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export async function scheduleDailyReminder(
  time: string,
  notifications: typeof Notifications = Notifications
): Promise<void> {
  if (!isValidReminderTime(time)) throw new Error('Enter a valid reminder time in HH:MM format.');
  const [hour, minute] = time.split(':').map(Number);
  await notifications.cancelAllScheduledNotificationsAsync();
  await notifications.scheduleNotificationAsync({
    content: { title: '🏋️ Ready for today’s workout?', body: 'Open Fitness Level for today’s set.' },
    trigger: { type: notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

export async function cancelWorkoutReminders(notifications: typeof Notifications = Notifications): Promise<void> {
  await notifications.cancelAllScheduledNotificationsAsync();
}
