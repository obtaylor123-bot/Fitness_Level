jest.mock('expo-notifications', () => ({
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'reminder-id'),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import * as Notifications from 'expo-notifications';
import { cancelWorkoutReminders, isValidReminderTime, scheduleDailyReminder } from '../reminders';

describe('local workout reminders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('validates the 24-hour HH:MM clock', () => {
    expect(isValidReminderTime('00:00')).toBe(true);
    expect(isValidReminderTime('23:59')).toBe(true);
    expect(isValidReminderTime('24:00')).toBe(false);
    expect(isValidReminderTime('08:60')).toBe(false);
    expect(isValidReminderTime('8:00')).toBe(false);
  });

  it('cancels prior schedules and schedules a daily notification at the selected time', async () => {
    await scheduleDailyReminder('08:30');
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      trigger: { type: 'daily', hour: 8, minute: 30 },
    }));
  });

  it('cancels scheduled reminders', async () => {
    await cancelWorkoutReminders();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});
