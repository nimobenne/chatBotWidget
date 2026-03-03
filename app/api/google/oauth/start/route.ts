import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleOAuthState, buildGoogleOAuthUrl } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 });

  const state = buildGoogleOAuthState({ businessId, ts: Date.now() });
  const url = buildGoogleOAuthUrl(state);
  return NextResponse.redirect(url);
}
