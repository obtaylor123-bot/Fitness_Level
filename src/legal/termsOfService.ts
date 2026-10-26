// DRAFT - business identity and legal review remain required before release.
import { BUSINESS_DETAILS } from '../config/business';

export const TERMS_UPDATED = 'October 26, 2026';

export const TERMS_OF_SERVICE = `Terms of Service
Last updated: ${TERMS_UPDATED}

DRAFT SERVICE SUMMARY
Fitness Level provides workout suggestions, progress tracking, optional weight tracking, and optional local workout reminders. ${BUSINESS_DETAILS.name} is the app provider; its identity and contact information must be completed before release.

Accounts and information
The app offers guest, Google, and email/password sign-in through Supabase Auth. Guest accounts do not require an email address, but their profile and workout information are stored in the app owner's Supabase project. Guest accounts cannot currently be linked to a Google or email identity; signing out, clearing app data, or reinstalling can make a guest account inaccessible. Account deletion is available from Profile and requires a network connection. The app does not ask for or verify age; the owner must confirm the target audience and applicable requirements before release.

This screen is a draft service summary, not a complete agreement. The app owner and a qualified legal reviewer must provide and approve the applicable terms before release.

Contact
Business: ${BUSINESS_DETAILS.name}
Support: ${BUSINESS_DETAILS.supportEmail}
Address: ${BUSINESS_DETAILS.physicalAddress}
Website: ${BUSINESS_DETAILS.website}`;
