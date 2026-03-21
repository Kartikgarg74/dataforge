/**
 * Public Share API Endpoint
 *
 * POST /api/public-share
 * Fetches share info by slug, verifies passwords, increments view counts.
 * Used by public/embed pages (client components can't import server-only libs).
 */

import { NextResponse } from 'next/server';
import { getShareBySlug, incrementViewCount } from '@/lib/sharing';
import { getDashboard } from '@/lib/dashboard';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, slug, password } = body as {
      action: 'get' | 'verify' | 'view';
      slug?: string;
      password?: string;
    };

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    switch (action) {
      case 'get': {
        const share = getShareBySlug(slug);
        if (!share) {
          return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
        }

        // Don't send password hash to client
        const safeShare = {
          id: share.id,
          resourceType: share.resourceType,
          resourceId: share.resourceId,
          slug: share.slug,
          accessType: share.accessType,
          viewCount: share.viewCount,
          createdAt: share.createdAt,
          needsPassword: share.accessType === 'password',
        };

        return NextResponse.json({ success: true, share: safeShare });
      }

      case 'verify': {
        const share = getShareBySlug(slug);
        if (!share) {
          return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
        }

        if (share.accessType !== 'password') {
          return NextResponse.json({ success: true, verified: true });
        }

        if (!password) {
          return NextResponse.json({ success: true, verified: false });
        }

        // Hash the provided password and compare
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashHex = Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, '0')
        ).join('');

        const verified = hashHex === share.passwordHash;
        return NextResponse.json({ success: true, verified });
      }

      case 'view': {
        const share = getShareBySlug(slug);
        if (!share) {
          return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
        }

        incrementViewCount(slug);

        // Fetch the resource data
        let resource = null;
        if (share.resourceType === 'dashboard') {
          const dashboard = getDashboard(share.resourceId);
          if (dashboard) {
            resource = {
              type: 'dashboard' as const,
              id: dashboard.id,
              name: dashboard.name,
              description: dashboard.description,
              widgets: dashboard.widgets.map((w) => ({
                id: w.id,
                title: w.title,
                widgetType: w.widgetType,
                querySQL: w.querySQL,
                position: w.position,
                visualization: w.visualization,
                sortOrder: w.sortOrder,
              })),
            };
          }
        } else {
          // For query type shares, return minimal info
          resource = {
            type: 'query' as const,
            id: share.resourceId,
            name: 'Shared Query',
          };
        }

        return NextResponse.json({ success: true, resource });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Public share API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
