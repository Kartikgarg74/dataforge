/**
 * Table Permissions API
 *
 * POST /api/permissions
 * Actions: set, get, check
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  setTablePermission,
  getTablePermissions,
  checkTableAccess,
} from '@/lib/auth/table-permissions';
import type { TableVisibility } from '@/lib/auth/table-permissions';
import type { UserRole } from '@/lib/auth/types';

const VisibilityEnum = z.enum(['visible', 'hidden', 'restricted']);
const RoleEnum = z.enum(['owner', 'admin', 'editor', 'viewer']);

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set'),
    connectorId: z.string().min(1),
    tableName: z.string().min(1),
    visibility: VisibilityEnum,
    allowedRoles: z.array(RoleEnum).optional(),
    hiddenColumns: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal('get'),
    connectorId: z.string().min(1),
  }),
  z.object({
    action: z.literal('check'),
    connectorId: z.string().min(1),
    tableName: z.string().min(1),
    userRole: RoleEnum,
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'set': {
        setTablePermission(
          data.connectorId,
          data.tableName,
          data.visibility as TableVisibility,
          data.allowedRoles as UserRole[] | undefined,
          data.hiddenColumns,
        );
        return NextResponse.json({ success: true });
      }

      case 'get': {
        const permissions = getTablePermissions(data.connectorId);
        return NextResponse.json({ success: true, permissions });
      }

      case 'check': {
        const result = checkTableAccess(
          data.connectorId,
          data.tableName,
          data.userRole as UserRole,
        );
        return NextResponse.json({ success: true, ...result });
      }
    }
  } catch (error) {
    console.error('Permissions API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
