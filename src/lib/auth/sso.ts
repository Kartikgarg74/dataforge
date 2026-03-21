/**
 * SSO (Single Sign-On) Integration
 *
 * Full OAuth 2.0 flow implementations for Google and GitHub.
 * Uses environment variables for client credentials:
 *   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *   - APP_URL (base URL for redirect URIs)
 */

import type { User } from './types';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set. SSO will not work without it.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Google OAuth 2.0
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Build the Google OAuth authorization URL.
 * The user should be redirected to this URL to begin the sign-in flow.
 */
export function getGoogleAuthUrl(): string {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const redirectUri = `${getAppUrl()}/api/auth/google?callback=true`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code from Google for user info.
 * Returns a User object built from the Google profile.
 */
export async function handleGoogleCallback(code: string): Promise<User> {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = `${getAppUrl()}/api/auth/google?callback=true`;

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${errorBody}`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
  };

  // Fetch user info
  const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const profile = (await userInfoRes.json()) as {
    id: string;
    email: string;
    name?: string;
    picture?: string;
  };

  return {
    id: `google_${profile.id}`,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GitHub OAuth 2.0
// ---------------------------------------------------------------------------

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

/**
 * Build the GitHub OAuth authorization URL.
 * The user should be redirected to this URL to begin the sign-in flow.
 */
export function getGitHubAuthUrl(): string {
  const clientId = requireEnv('GITHUB_CLIENT_ID');
  const redirectUri = `${getAppUrl()}/api/auth/github?callback=true`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  });

  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization code from GitHub for user info.
 * Returns a User object built from the GitHub profile.
 */
export async function handleGitHubCallback(code: string): Promise<User> {
  const clientId = requireEnv('GITHUB_CLIENT_ID');
  const clientSecret = requireEnv('GITHUB_CLIENT_SECRET');

  // Exchange code for access token
  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    throw new Error(`GitHub token exchange failed: ${errorBody}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      `GitHub OAuth error: ${tokenData.error_description ?? tokenData.error ?? 'No access token'}`,
    );
  }

  const accessToken = tokenData.access_token;

  // Fetch user profile
  const userRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!userRes.ok) {
    throw new Error('Failed to fetch GitHub user profile');
  }

  const profile = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
  };

  // If email is not public on the profile, fetch from the emails endpoint
  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch(GITHUB_EMAILS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email ?? emails[0]?.email;
    }
  }

  if (!email) {
    throw new Error(
      'Could not retrieve email from GitHub. Ensure the "user:email" scope is granted.',
    );
  }

  return {
    id: `github_${profile.id}`,
    email,
    name: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url,
    createdAt: new Date().toISOString(),
  };
}
