import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed, verifyAdminToken } from '@/lib/adminAuth';
import { getRequestContext } from '@/lib/observability';

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
  const ctx = getRequestContext(req, 'GET /api/auth/google/status');
  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const bearerToken = hasBearer ? authHeader.slice(7) : '';
    const isAdminBearer = !!bearerToken && verifyAdminToken(bearerToken);
    const ownerCookieToken = req.cookies.get('owner_token')?.value || '';
    if (!hasBearer && !isAdminAuthed(req) && !ownerCookieToken) {
      ctx.log('warn', 'Google status unauthorized', { reason: 'missing_admin_auth', businessId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((hasBearer && !isAdminBearer) || (!hasBearer && !!ownerCookieToken)) {
      const { user, supabase } = await requireOwner(req);
      const { data: ownershipRows, error: ownErr } = await supabase
        .from('business_owners')
        .select('business_id')
        .eq('owner_user_id', user.id)
        .limit(20);
      if (ownErr) {
        ctx.log('error', 'Owner business ownership query failed', { ownerId: user.id, businessId, error: ownErr.message });
        return NextResponse.json({ error: ownErr.message, code: 'OWNERSHIP_QUERY_FAILED' }, { status: 400 });
      }
      const ownerBusinessIds = (ownershipRows || []).map((r: any) => r.business_id);
      if (!ownerBusinessIds.length) {
        ctx.log('warn', 'Owner has no business assignments', { ownerId: user.id, businessId });
        return NextResponse.json({ error: 'Forbidden', code: 'OWNER_HAS_NO_BUSINESSES' }, { status: 403 });
      }

      const { data: ownedBiz, error: bizErr } = await supabase
        .from('businesses')
        .select('id')
        .in('id', ownerBusinessIds)
        .eq('slug', businessId)
        .limit(1);
      if (bizErr) {
        ctx.log('error', 'Owner owned business lookup failed', { ownerId: user.id, businessId, error: bizErr.message });
        return NextResponse.json({ error: bizErr.message, code: 'OWNED_BUSINESS_LOOKUP_FAILED' }, { status: 400 });
      }
      if (!ownedBiz || ownedBiz.length === 0) {
        ctx.log('warn', 'Owner forbidden for business', { ownerId: user.id, businessId, ownerBusinessCount: ownerBusinessIds.length });
        return NextResponse.json({ error: 'Forbidden', code: 'OWNER_NOT_ASSIGNED_TO_BUSINESS' }, { status: 403 });
      }
    }

    const store = getStore();
    const conn = await store.getGoogleCalendarConnection(businessId);
    if (!conn) {
      ctx.log('info', 'No calendar connection in DB', { businessId });
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
    ctx.log('error', 'Google status failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
