/**
 * Role-Based Access Control
 *
 * Defines permissions per role and provides helpers
 * to check or assert access before executing actions.
 */

import type { UserRole } from './types';

const ALL_ACTIONS = [
  'team.manage',
  'connection.manage',
  'dashboard.create',
  'dashboard.edit',
  'dashboard.view',
  'query.create',
  'query.view',
  'query.execute',
  'share.create',
  'schedule.create',
  'export.data',
  'settings.manage',
] as const;

export type Action = (typeof ALL_ACTIONS)[number];

/**
 * Maps each role to the set of actions it is allowed to perform.
 *
 * - owner:  full access
 * - admin:  everything except billing / settings.manage
 * - editor: create & edit dashboards, queries, share, schedule, export
 * - viewer: read-only access + query execution
 */
export const PERMISSIONS: Record<UserRole, ReadonlySet<string>> = {
  owner: new Set<string>(ALL_ACTIONS),

  admin: new Set<string>(
    ALL_ACTIONS.filter((a) => a !== 'settings.manage'),
  ),

  editor: new Set<string>([
    'dashboard.create',
    'dashboard.edit',
    'dashboard.view',
    'query.create',
    'query.view',
    'query.execute',
    'share.create',
    'schedule.create',
    'export.data',
  ]),

  viewer: new Set<string>([
    'dashboard.view',
    'query.view',
    'query.execute',
  ]),
};

/** Returns true when `role` is allowed to perform `action`. */
export function hasPermission(role: UserRole, action: string): boolean {
  const allowed = PERMISSIONS[role];
  return allowed ? allowed.has(action) : false;
}

/**
 * Throws an error when `role` is **not** allowed to perform `action`.
 * Use in API handlers to guard destructive operations.
 */
export function assertPermission(role: UserRole, action: string): void {
  if (!hasPermission(role, action)) {
    throw new Error(
      `Permission denied: role "${role}" cannot perform "${action}"`,
    );
  }
}
