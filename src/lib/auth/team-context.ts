/**
 * Team-Scoping Middleware
 *
 * Validates the session, extracts the teamId and passes a
 * fully-authenticated Session to the handler. All downstream
 * queries MUST use `session.teamId` to enforce data isolation.
 */

import { NextResponse } from 'next/server';
import { getSession } from './session';
import type { Session } from './types';

/**
 * Wrap an API handler so it only executes when the caller has
 * a valid session bound to a team.
 *
 * Returns 401 when there is no session at all, or 403 when the
 * session exists but the user is not associated with a team.
 */
export async function withTeamContext<T>(
  request: Request,
  handler: (session: Session) => Promise<T>,
): Promise<Response> {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }

  if (!session.teamId) {
    return NextResponse.json(
      { error: 'No team context — user is not a member of any team' },
      { status: 403 },
    );
  }

  try {
    const result = await handler(session);

    // If the handler already returned a Response, pass it through.
    if (result instanceof Response) {
      return result;
    }

    return NextResponse.json(result);
  } catch (error) {
    // Surface permission errors as 403 to distinguish from server errors.
    if (error instanceof Error && error.message.startsWith('Permission denied')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error('Team context handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
