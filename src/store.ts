// src/store.ts

import { create } from 'zustand';
import { UserProfile } from './models/UserProfile';
import { DailySet } from './models/DailySet';

export type AppState = {
  user: UserProfile | null;
  dailySet: DailySet | null;
  consentAcceptedAt: string | null;
  hydrated: boolean;
  setUser: (user: UserProfile) => void;
  clearUser: () => void;
  setDailySet: (set: DailySet) => void;
  setConsentAcceptedAt: (acceptedAt: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useStore = create<AppState>((set) => ({
  user: null,
  dailySet: null,
  consentAcceptedAt: null,
  hydrated: false,
  setUser: (user: UserProfile) => set({ user }),
  clearUser: () => set({ user: null, dailySet: null }),
  setDailySet: (dailySet: DailySet) => set({ dailySet }),
  setConsentAcceptedAt: (consentAcceptedAt) => set({ consentAcceptedAt }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
