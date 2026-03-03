import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, parseGoogleOAuthState } from '@/lib/google';
import { getSupabaseStore } from '@/lib/store.supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state) return NextResponse.json({ error: 'Missing code/state' }, { status: 400 });

  const decoded = parseGoogleOAuthState(state);
  const store = getSupabaseStore();
  const business = await store.getBusinessBySlug(decoded.businessId);
  if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refreshToken) {
    return NextResponse.json({ error: 'Google did not return a refresh token. Reconnect with consent.' }, { status: 400 });
  }

  await store.upsertGoogleConnection({ business_id: business.id, refresh_token: tokens.refreshToken, calendar_id: 'primary' });

  return NextResponse.json({ ok: true, message: `Google Calendar connected for ${business.slug}.` });
}
