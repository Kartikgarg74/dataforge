import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission, PERMISSIONS } from '../../src/lib/auth/rbac';
import type { UserRole } from '../../src/lib/auth/types';

describe('RBAC', () => {
  describe('owner permissions', () => {
    const role: UserRole = 'owner';

    it('has all permissions', () => {
      expect(hasPermission(role, 'team.manage')).toBe(true);
      expect(hasPermission(role, 'connection.manage')).toBe(true);
      expect(hasPermission(role, 'dashboard.create')).toBe(true);
      expect(hasPermission(role, 'dashboard.edit')).toBe(true);
      expect(hasPermission(role, 'dashboard.view')).toBe(true);
      expect(hasPermission(role, 'query.create')).toBe(true);
      expect(hasPermission(role, 'query.view')).toBe(true);
      expect(hasPermission(role, 'query.execute')).toBe(true);
      expect(hasPermission(role, 'share.create')).toBe(true);
      expect(hasPermission(role, 'schedule.create')).toBe(true);
      expect(hasPermission(role, 'export.data')).toBe(true);
      expect(hasPermission(role, 'settings.manage')).toBe(true);
    });
  });

  describe('admin permissions', () => {
    const role: UserRole = 'admin';

    it('has all permissions except settings.manage', () => {
      expect(hasPermission(role, 'team.manage')).toBe(true);
      expect(hasPermission(role, 'connection.manage')).toBe(true);
      expect(hasPermission(role, 'dashboard.create')).toBe(true);
      expect(hasPermission(role, 'dashboard.edit')).toBe(true);
      expect(hasPermission(role, 'dashboard.view')).toBe(true);
      expect(hasPermission(role, 'query.create')).toBe(true);
      expect(hasPermission(role, 'query.view')).toBe(true);
      expect(hasPermission(role, 'query.execute')).toBe(true);
      expect(hasPermission(role, 'share.create')).toBe(true);
      expect(hasPermission(role, 'schedule.create')).toBe(true);
      expect(hasPermission(role, 'export.data')).toBe(true);
    });

    it('does NOT have settings.manage', () => {
      expect(hasPermission(role, 'settings.manage')).toBe(false);
    });
  });

  describe('editor permissions', () => {
    const role: UserRole = 'editor';

    it('can create and edit dashboards', () => {
      expect(hasPermission(role, 'dashboard.create')).toBe(true);
      expect(hasPermission(role, 'dashboard.edit')).toBe(true);
      expect(hasPermission(role, 'dashboard.view')).toBe(true);
    });

    it('can create and execute queries', () => {
      expect(hasPermission(role, 'query.create')).toBe(true);
      expect(hasPermission(role, 'query.view')).toBe(true);
      expect(hasPermission(role, 'query.execute')).toBe(true);
    });

    it('can share, schedule, and export', () => {
      expect(hasPermission(role, 'share.create')).toBe(true);
      expect(hasPermission(role, 'schedule.create')).toBe(true);
      expect(hasPermission(role, 'export.data')).toBe(true);
    });

    it('cannot manage team or connections', () => {
      expect(hasPermission(role, 'team.manage')).toBe(false);
      expect(hasPermission(role, 'connection.manage')).toBe(false);
    });

    it('cannot manage settings', () => {
      expect(hasPermission(role, 'settings.manage')).toBe(false);
    });
  });

  describe('viewer permissions', () => {
    const role: UserRole = 'viewer';

    it('can view dashboards and queries', () => {
      expect(hasPermission(role, 'dashboard.view')).toBe(true);
      expect(hasPermission(role, 'query.view')).toBe(true);
    });

    it('can execute queries', () => {
      expect(hasPermission(role, 'query.execute')).toBe(true);
    });

    it('cannot create or edit', () => {
      expect(hasPermission(role, 'dashboard.create')).toBe(false);
      expect(hasPermission(role, 'dashboard.edit')).toBe(false);
      expect(hasPermission(role, 'query.create')).toBe(false);
    });

    it('cannot manage, share, schedule, or export', () => {
      expect(hasPermission(role, 'team.manage')).toBe(false);
      expect(hasPermission(role, 'connection.manage')).toBe(false);
      expect(hasPermission(role, 'settings.manage')).toBe(false);
      expect(hasPermission(role, 'share.create')).toBe(false);
      expect(hasPermission(role, 'schedule.create')).toBe(false);
      expect(hasPermission(role, 'export.data')).toBe(false);
    });
  });

  describe('hasPermission edge cases', () => {
    it('returns false for an unknown action', () => {
      expect(hasPermission('owner', 'nonexistent.action')).toBe(false);
    });
  });

  describe('assertPermission', () => {
    it('does not throw when permission is granted', () => {
      expect(() => assertPermission('owner', 'settings.manage')).not.toThrow();
    });

    it('throws with descriptive message when permission is denied', () => {
      expect(() => assertPermission('viewer', 'settings.manage')).toThrowError(
        /Permission denied.*viewer.*settings\.manage/,
      );
    });

    it('throws for editor trying to manage connections', () => {
      expect(() => assertPermission('editor', 'connection.manage')).toThrowError(
        /Permission denied/,
      );
    });

    it('throws for admin trying to manage settings', () => {
      expect(() => assertPermission('admin', 'settings.manage')).toThrowError(
        /Permission denied/,
      );
    });
  });

  describe('PERMISSIONS map', () => {
    it('covers all four roles', () => {
      const roles: UserRole[] = ['owner', 'admin', 'editor', 'viewer'];
      for (const role of roles) {
        expect(PERMISSIONS[role]).toBeDefined();
        expect(PERMISSIONS[role].size).toBeGreaterThan(0);
      }
    });

    it('owner has the most permissions', () => {
      expect(PERMISSIONS.owner.size).toBeGreaterThanOrEqual(PERMISSIONS.admin.size);
      expect(PERMISSIONS.admin.size).toBeGreaterThanOrEqual(PERMISSIONS.editor.size);
      expect(PERMISSIONS.editor.size).toBeGreaterThanOrEqual(PERMISSIONS.viewer.size);
    });
  });
});
