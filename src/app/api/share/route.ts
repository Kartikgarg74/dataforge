/**
 * Share API Endpoint
 *
 * POST /api/share
 * Create, list, and revoke share links.
 */

import { NextResponse } from 'next/server';
import { apiMiddleware } from '@/lib/security/api-middleware';
import { z } from 'zod';
import { createShare, listShares, revokeShare } from '@/lib/sharing';

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    resourceType: z.enum(['dashboard', 'query']),
    resourceId: z.string().min(1),
    access: z.enum(['public', 'password', 'team', 'allowlist']),
    password: z.string().optional(),
    allowedEmails: z.array(z.string().email()).optional(),
    expiresAt: z.string().optional(),
    maxViews: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal('list'),
    teamId: z.string().optional(),
  }),
  z.object({
    action: z.literal('revoke'),
    shareId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'share.manage' });
    if (middlewareError) return middlewareError;

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    switch (data.action) {
      case 'create': {
        const result = await createShare({
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          access: data.access,
          password: data.password,
          allowedEmails: data.allowedEmails,
          expiresAt: data.expiresAt,
          maxViews: data.maxViews,
        });

        return NextResponse.json({
          success: true,
          share: result.share,
          url: result.url,
          embedUrl: result.embedUrl,
          embedCode: result.embedCode,
        });
      }

      case 'list': {
        const shares = listShares(data.teamId || '');
        return NextResponse.json({ success: true, shares });
      }

      case 'revoke': {
        revokeShare(data.shareId);
        return NextResponse.json({ success: true });
      }
    }
  } catch (error) {
    console.error('Share API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Share operation failed' },
      { status: 500 }
    );
  }
}
