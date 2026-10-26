import { runAccountDeletion } from '../accountDeletionFlow';

const noop = async () => undefined;

describe('account deletion flow', () => {
  it('deletes cloud data first, then clears local records, reminders, and session', async () => {
    const order: string[] = [];
    const result = await runAccountDeletion({
      deleteCloudAccount: async () => { order.push('cloud'); },
      clearLocalRecords: async () => { order.push('local'); },
      cancelReminders: async () => { order.push('reminders'); },
      signOutLocal: async () => { order.push('signout'); },
    });
    expect(order).toEqual(['cloud', 'local', 'reminders', 'signout']);
    expect(result).toEqual({ cloudDeleted: true, localRecordsCleared: true, remindersCancelled: true, localSessionCleared: true });
  });

  it('leaves local data and session intact after offline cloud deletion failure so the user can retry', async () => {
    const clearLocalRecords = jest.fn(noop);
    const cancelReminders = jest.fn(noop);
    const signOutLocal = jest.fn(noop);
    await expect(runAccountDeletion({
      deleteCloudAccount: async () => { throw new Error('offline'); },
      clearLocalRecords, cancelReminders, signOutLocal,
    })).rejects.toThrow('offline');
    expect(clearLocalRecords).not.toHaveBeenCalled();
    expect(cancelReminders).not.toHaveBeenCalled();
    expect(signOutLocal).not.toHaveBeenCalled();
  });

  it('reports partial device cleanup and continues the remaining cleanup steps', async () => {
    const result = await runAccountDeletion({
      deleteCloudAccount: noop,
      clearLocalRecords: async () => { throw new Error('storage busy'); },
      cancelReminders: noop,
      signOutLocal: noop,
    });
    expect(result.cloudDeleted).toBe(true);
    expect(result.localRecordsCleared).toBe(false);
    expect(result.remindersCancelled).toBe(true);
    expect(result.localSessionCleared).toBe(true);
  });
});
