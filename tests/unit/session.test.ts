import { describe, it, expect } from 'vitest';
import type { Session, UserRole } from '../../src/lib/auth/types';

describe('Session types', () => {
  it('Session interface has user, teamId, and role fields', () => {
    const session: Session = {
      user: {
        id: 'u1',
        email: 'test@example.com',
        createdAt: '2024-01-01',
      },
      teamId: 'team-1',
      role: 'editor',
    };

    expect(session.user).toBeDefined();
    expect(session.user.id).toBe('u1');
    expect(session.teamId).toBe('team-1');
    expect(session.role).toBe('editor');
  });

  it('UserRole includes owner', () => {
    const role: UserRole = 'owner';
    expect(role).toBe('owner');
  });

  it('UserRole includes admin', () => {
    const role: UserRole = 'admin';
    expect(role).toBe('admin');
  });

  it('UserRole includes editor', () => {
    const role: UserRole = 'editor';
    expect(role).toBe('editor');
  });

  it('UserRole includes viewer', () => {
    const role: UserRole = 'viewer';
    expect(role).toBe('viewer');
  });
});
