import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/calendar';
import { getStore } from '@/lib/store';

function authed(req: NextRequest): boolean {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const provided = req.headers.get('x-admin-password') || req.nextUrl.searchParams.get('password');
  return provided === pwd;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Admin disabled' }, { status: 404 });
    }
    if (!authed(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const nonce = randomUUID();
    const authUrl = getGoogleAuthUrl(businessId, nonce);
    const res = NextResponse.redirect(authUrl);
    res.cookies.set('google_oauth_state', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/'
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
