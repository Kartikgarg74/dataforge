import { NextResponse } from 'next/server';
import { enforceApiProtection } from '@/lib/security/api-guard';

export async function POST(request: Request) {
  const blocked = enforceApiProtection(request, {
    route: 'notion',
    rateLimit: { windowMs: 60_000, max: 30 },
  });
  if (blocked) return blocked;

  try {
    const { title } = await request.json();

    return NextResponse.json({
      success: false,
      status: 'not_configured',
      message: 'Notion integration is currently disabled until production OAuth flow is implemented.',
      title,
      pageUrl: '#'
    }, { status: 501 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
