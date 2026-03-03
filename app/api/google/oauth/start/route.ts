import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleOAuthUrl } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId');
  if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 });

  const state = Buffer.from(JSON.stringify({ businessId }), 'utf8').toString('base64url');
  const url = buildGoogleOAuthUrl(state);
  return NextResponse.redirect(url);
}
