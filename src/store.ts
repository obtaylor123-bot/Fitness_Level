// src/store.ts

import { create } from 'zustand';
import { UserProfile } from './models/UserProfile';
import { DailySet } from './models/DailySet';

export type AppState = {
  authUserId: string | null;
  authReady: boolean;
  user: UserProfile | null;
  dailySet: DailySet | null;
  consentAcceptedAt: string | null;
  hydrated: boolean;
  legacyImportAvailable: boolean;
  setUser: (user: UserProfile | null) => void;
  setAuthUserId: (authUserId: string | null) => void;
  setAuthReady: (authReady: boolean) => void;
  clearUser: () => void;
  setDailySet: (set: DailySet | null) => void;
  setConsentAcceptedAt: (acceptedAt: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setLegacyImportAvailable: (available: boolean) => void;
};

export const useStore = create<AppState>((set) => ({
  authUserId: null,
  authReady: false,
  user: null,
  dailySet: null,
  consentAcceptedAt: null,
  hydrated: false,
  legacyImportAvailable: false,
  setUser: (user: UserProfile | null) => set({ user }),
  setAuthUserId: (authUserId: string | null) => set({ authUserId }),
  setAuthReady: (authReady: boolean) => set({ authReady }),
  clearUser: () => set({ user: null, dailySet: null }),
  setDailySet: (dailySet: DailySet | null) => set({ dailySet }),
  setConsentAcceptedAt: (consentAcceptedAt) => set({ consentAcceptedAt }),
  setHydrated: (hydrated) => set({ hydrated }),
  setLegacyImportAvailable: (legacyImportAvailable) => set({ legacyImportAvailable }),
}));
