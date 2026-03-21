import { NextResponse } from 'next/server';
import { enforceApiProtection } from '@/lib/security/api-guard';

export async function POST(request: Request) {
  const blocked = enforceApiProtection(request, {
    route: 'airtable',
    rateLimit: { windowMs: 60_000, max: 30 },
  });
  if (blocked) return blocked;

  try {
    const { data, destination } = await request.json();

    return NextResponse.json({
      success: false,
      status: 'not_configured',
      message: 'Airtable export is currently disabled until production API credentials are configured.',
      rows: data?.length || 0,
      destination
    }, { status: 501 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
