export interface AccountDeletionSteps {
  deleteCloudAccount: () => Promise<void>;
  clearLocalRecords: () => Promise<void>;
  cancelReminders: () => Promise<void>;
  signOutLocal: () => Promise<void>;
}

export interface AccountDeletionResult {
  cloudDeleted: true;
  localRecordsCleared: boolean;
  remindersCancelled: boolean;
  localSessionCleared: boolean;
}

/** A failed cloud request leaves every local record and session untouched so the user can retry. */
export async function runAccountDeletion(steps: AccountDeletionSteps): Promise<AccountDeletionResult> {
  await steps.deleteCloudAccount();

  let localRecordsCleared = false;
  let remindersCancelled = false;
  let localSessionCleared = false;
  try {
    await steps.clearLocalRecords();
    localRecordsCleared = true;
  } catch {
    // Continue cleanup and report a retryable local failure to the caller.
  }
  try {
    await steps.cancelReminders();
    remindersCancelled = true;
  } catch {
    // Continue cleanup and report a retryable local failure to the caller.
  }
  try {
    await steps.signOutLocal();
    localSessionCleared = true;
  } catch {
    // The UI will still clear in-memory account data after server deletion.
  }

  return { cloudDeleted: true, localRecordsCleared, remindersCancelled, localSessionCleared };
}
