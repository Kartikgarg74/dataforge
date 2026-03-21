/**
 * Team Management API
 *
 * POST /api/team
 * Actions: create, invite, update_role, remove, list
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import Database from 'better-sqlite3';
import path from 'path';
import { withTeamContext, assertPermission } from '@/lib/auth';
import type { Session, UserRole } from '@/lib/auth';

const DB_PATH = path.resolve(process.cwd(), 'db', 'app.db');

function getDb() {
  return new Database(DB_PATH);
}

const RoleEnum = z.enum(['owner', 'admin', 'editor', 'viewer']);

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  }),
  z.object({
    action: z.literal('invite'),
    email: z.string().email(),
    role: RoleEnum,
    name: z.string().optional(),
  }),
  z.object({
    action: z.literal('update_role'),
    userId: z.string().min(1),
    role: RoleEnum,
  }),
  z.object({
    action: z.literal('remove'),
    userId: z.string().min(1),
  }),
  z.object({
    action: z.literal('list'),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'team.manage' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // `create` does not require an existing team context — the caller
    // is creating a brand-new team. All other actions are team-scoped.
    if (data.action === 'create') {
      return handleCreate(request, data);
    }

    return withTeamContext(request, async (session: Session) => {
      switch (data.action) {
        case 'invite':
          return handleInvite(session, data);
        case 'update_role':
          return handleUpdateRole(session, data);
        case 'remove':
          return handleRemove(session, data);
        case 'list':
          return handleList(session);
      }
    });
  } catch (error) {
    console.error('Team API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCreate(
  request: Request,
  data: { name: string; slug: string },
) {
  // For create we need a session but not necessarily a team context.
  const { getSession } = await import('@/lib/auth');
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getDb();
  try {
    const teamId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    db.exec('BEGIN');

    db.prepare(
      `INSERT INTO teams (id, name, slug) VALUES (?, ?, ?)`,
    ).run(teamId, data.name, data.slug);

    db.prepare(
      `INSERT INTO team_members (id, team_id, user_id, email, name, role)
       VALUES (?, ?, ?, ?, ?, 'owner')`,
    ).run(memberId, teamId, session.user.id, session.user.email, session.user.name ?? null);

    db.exec('COMMIT');

    return NextResponse.json({
      success: true,
      team: { id: teamId, name: data.name, slug: data.slug, plan: 'free' },
    });
  } catch (err) {
    db.exec('ROLLBACK');
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A team with this slug already exists' },
        { status: 409 },
      );
    }
    throw err;
  } finally {
    db.close();
  }
}

async function handleInvite(
  session: Session,
  data: { email: string; role: UserRole; name?: string },
) {
  assertPermission(session.role, 'team.manage');

  const db = getDb();
  try {
    // Ensure the target user exists — create a stub if not.
    let userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email) as
      | { id: string }
      | undefined;

    if (!userRow) {
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').run(
        userId,
        data.email,
        data.name ?? null,
      );
      userRow = { id: userId };
    }

    const memberId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO team_members (id, team_id, user_id, email, name, role, invited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      memberId,
      session.teamId,
      userRow.id,
      data.email,
      data.name ?? null,
      data.role,
      session.user.id,
    );

    return { success: true, memberId, userId: userRow.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 409 },
      );
    }
    throw err;
  } finally {
    db.close();
  }
}

async function handleUpdateRole(
  session: Session,
  data: { userId: string; role: UserRole },
) {
  assertPermission(session.role, 'team.manage');

  const db = getDb();
  try {
    const member = db
      .prepare('SELECT id, role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(session.teamId, data.userId) as { id: string; role: string } | undefined;

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent demoting the last owner.
    if (member.role === 'owner' && data.role !== 'owner') {
      const ownerCount = db
        .prepare("SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ? AND role = 'owner'")
        .get(session.teamId) as { cnt: number };

      if (ownerCount.cnt <= 1) {
        return NextResponse.json(
          { error: 'Cannot change role of the last owner' },
          { status: 400 },
        );
      }
    }

    db.prepare('UPDATE team_members SET role = ? WHERE id = ?').run(data.role, member.id);

    return { success: true };
  } finally {
    db.close();
  }
}

async function handleRemove(session: Session, data: { userId: string }) {
  assertPermission(session.role, 'team.manage');

  const db = getDb();
  try {
    const member = db
      .prepare('SELECT id, role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(session.teamId, data.userId) as { id: string; role: string } | undefined;

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Prevent removing the last owner.
    if (member.role === 'owner') {
      const ownerCount = db
        .prepare("SELECT COUNT(*) AS cnt FROM team_members WHERE team_id = ? AND role = 'owner'")
        .get(session.teamId) as { cnt: number };

      if (ownerCount.cnt <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner' },
          { status: 400 },
        );
      }
    }

    db.prepare('DELETE FROM team_members WHERE id = ?').run(member.id);

    return { success: true };
  } finally {
    db.close();
  }
}

async function handleList(session: Session) {
  const db = getDb();
  try {
    const members = db
      .prepare(
        `SELECT user_id AS userId, team_id AS teamId, email, name, role, joined_at AS joinedAt
         FROM team_members
         WHERE team_id = ?
         ORDER BY joined_at ASC`,
      )
      .all(session.teamId);

    return { success: true, members };
  } finally {
    db.close();
  }
}
