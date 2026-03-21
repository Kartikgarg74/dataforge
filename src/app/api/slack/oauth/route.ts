/**
 * Slack OAuth API Endpoint
 *
 * GET /api/slack/oauth
 * Redirects to Slack OAuth URL or handles the callback.
 *
 * Query params:
 *   - action=callback&code=xxx  -> Handle OAuth callback from Slack
 *   - (no action)               -> Redirect to Slack install URL
 */

import { NextResponse } from 'next/server';
import { getSlackInstallUrl, exchangeCodeForToken } from '@/lib/slack/oauth';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Handle OAuth callback from Slack
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('[slack/oauth] User denied or error:', error);
      return NextResponse.redirect(
        `${APP_URL}/settings?slack=error&message=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${APP_URL}/settings?slack=error&message=${encodeURIComponent('No authorization code received')}`
      );
    }

    try {
      const { teamName } = await exchangeCodeForToken(code);

      return NextResponse.redirect(
        `${APP_URL}/settings?slack=success&team=${encodeURIComponent(teamName)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      console.error('[slack/oauth] Token exchange failed:', message);

      return NextResponse.redirect(
        `${APP_URL}/settings?slack=error&message=${encodeURIComponent(message)}`
      );
    }
  }

  // Default: redirect to Slack OAuth install URL
  const installUrl = getSlackInstallUrl();
  return NextResponse.redirect(installUrl);
}
