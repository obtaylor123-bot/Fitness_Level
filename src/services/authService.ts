// src/services/authService.ts

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

// Complete any pending auth sessions on web/native
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth Configuration Placeholders for App Store / Play Store Release.
 * In production, obtain these IDs from the Google Cloud Console:
 * 1. Web Client ID: For web & Expo Go proxy
 * 2. Android Client ID: For standalone Android app build (matching your SHA-1 and package name)
 * 3. iOS Client ID: For standalone iOS app build (matching your Bundle ID)
 */
export const GOOGLE_CONFIG = {
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};

export function isGoogleSignInConfigured(): boolean {
  const clientId = Platform.select({
    android: GOOGLE_CONFIG.androidClientId,
    ios: GOOGLE_CONFIG.iosClientId,
    default: GOOGLE_CONFIG.webClientId,
  });
  return Boolean(
    clientId && !clientId.startsWith('YOUR_') &&
    GOOGLE_CONFIG.webClientId && !GOOGLE_CONFIG.webClientId.startsWith('YOUR_')
  );
}

export interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  photoUrl?: string;
}

/**
 * Initiates Google Sign-In.
 * Authentication is unavailable until a real OAuth client is configured. Never
 * substitute a fabricated identity: callers use this result to label profiles.
 */
export async function promptGoogleSignIn(): Promise<GoogleAuthUser | null> {
  const clientId = Platform.select({
    android: GOOGLE_CONFIG.androidClientId,
    ios: GOOGLE_CONFIG.iosClientId,
    default: GOOGLE_CONFIG.webClientId,
  });
  if (!isGoogleSignInConfigured() || !clientId) return null;

  try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'fitnesslevel',
      });

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };

      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success' && result.params.code && request.codeVerifier) {
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier },
          },
          discovery
        );
        // Fetch user profile from Google UserInfo API
        const userInfoResponse = await fetch(
          'https://www.googleapis.com/userinfo/v2/me',
          {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
          }
        );
        if (!userInfoResponse.ok) {
          throw new Error(`Google user info request failed (${userInfoResponse.status})`);
        }
        const userInfo = await userInfoResponse.json();
        if (typeof userInfo.id !== 'string' || typeof userInfo.email !== 'string') {
          throw new Error('Google returned an incomplete user profile');
        }
        return {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          photoUrl: userInfo.picture,
        };
      }
  } catch (e) {
    console.warn('Google OAuth flow encountered error:', e);
    throw e;
  }
  return null;
}
