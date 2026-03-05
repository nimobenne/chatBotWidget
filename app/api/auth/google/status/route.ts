import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed, verifyAdminToken } from '@/lib/adminAuth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function oauthClient(refreshToken: string, tokenType: string, scope: string) {
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken, token_type: tokenType, scope });
  return client;
}

export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const bearerToken = hasBearer ? authHeader.slice(7) : '';
    const isAdminBearer = !!bearerToken && verifyAdminToken(bearerToken);
    if (!hasBearer && !isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (hasBearer && !isAdminBearer) {
      const { user, supabase } = await requireOwner(req);
      const { data: business } = await supabase.from('businesses').select('id').eq('slug', businessId).single();
      if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
      const { data: ownership } = await supabase
        .from('business_owners')
        .select('business_id')
        .eq('business_id', business.id)
        .eq('owner_user_id', user.id)
        .single();
      if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const store = getStore();
    const conn = await store.getGoogleCalendarConnection(businessId);
    if (!conn) {
      return NextResponse.json({ connectedInDb: false, usable: false, calendarId: null, updatedAt: null });
    }

    let usable = false;
    let checkError: string | null = null;
    try {
      const auth = oauthClient(conn.refreshToken, conn.tokenType, conn.scope);
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.calendarList.list({ maxResults: 1 });
      usable = true;
    } catch (error) {
      usable = false;
      checkError = error instanceof Error ? error.message : 'Failed to validate token';
    }

    return NextResponse.json({
      connectedInDb: true,
      usable,
      calendarId: conn.calendarId,
      updatedAt: conn.updatedAt,
      checkError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
