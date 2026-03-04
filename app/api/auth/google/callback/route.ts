import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { exchangeCodeForTokens } from '@/lib/calendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(new URL('/admin?error=google_auth_failed', req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/admin?error=missing_params', req.url));
    }

    const [businessId, expectedState] = state.split(':');
    const currentState = searchParams.get('state_param') || '';

    if (currentState && currentState !== expectedState) {
      return NextResponse.redirect(new URL('/admin?error=invalid_state', req.url));
    }

    const tokens = await exchangeCodeForTokens(code);

    const store = getStore();
    await store.saveGoogleCalendarConnection({
      businessId,
      calendarId: 'primary',
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      scope: tokens.scope
    });

    return NextResponse.redirect(new URL('/admin?success=calendar_connected', req.url));
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/admin?error=token_exchange_failed', req.url));
  }
}
