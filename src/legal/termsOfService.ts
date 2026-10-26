// DRAFT - business identity and legal review remain required before release.
import { BUSINESS_DETAILS } from '../config/business';

export const TERMS_UPDATED = 'October 26, 2026';

export const TERMS_OF_SERVICE = `Terms of Service\nLast updated: ${TERMS_UPDATED}\n\nDRAFT SERVICE SUMMARY\nFitness Level provides workout suggestions, progress tracking, optional weight tracking, and optional local workout reminders. ${BUSINESS_DETAILS.name} is the app provider; its identity and contact information must be completed before release.\n\nAccounts and information\nThe app offers Google and email/password sign-in through Supabase Auth. Account, profile, workout, consent, and optional weight information are stored in the app owner's Supabase project. Account deletion is available from Profile and requires a network connection.\n\nThis screen is a draft service summary, not a complete agreement. The app owner and a qualified legal reviewer must provide and approve the applicable terms before release.\n\nContact\nBusiness: ${BUSINESS_DETAILS.name}\nSupport: ${BUSINESS_DETAILS.supportEmail}\nAddress: ${BUSINESS_DETAILS.physicalAddress}\nWebsite: ${BUSINESS_DETAILS.website}`;
