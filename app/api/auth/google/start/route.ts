import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/calendar';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed, verifyAdminToken } from '@/lib/adminAuth';
import { getRequestContext } from '@/lib/observability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req, 'GET /api/auth/google/start');
  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    const reconnect = req.nextUrl.searchParams.get('reconnect') === '1';
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = authHeader.startsWith('Bearer ');
    const bearerToken = hasBearer ? authHeader.slice(7) : '';
    const isAdminBearer = !!bearerToken && verifyAdminToken(bearerToken);
    if (!hasBearer && !isAdminAuthed(req)) {
      ctx.log('warn', 'Google connect unauthorized', { reason: 'missing_admin_auth' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (hasBearer && !isAdminBearer) {
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

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) {
      ctx.log('warn', 'Invalid business id on google start', { businessId });
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const store = getStore();
    const existingConn = await store.getGoogleCalendarConnection(businessId);
    if (existingConn) {
      if (!reconnect) {
        ctx.log('warn', 'Calendar already connected', { businessId });
        return NextResponse.json({ error: 'A calendar is already connected for this business. Use reconnect=1 to replace it.' }, { status: 409 });
      }
    }

    const nonce = randomUUID();
    const authUrl = getGoogleAuthUrl(businessId, nonce, hasBearer && !isAdminBearer ? 'owner' : 'admin');
    const mode = req.nextUrl.searchParams.get('mode') || '';
    const res = mode === 'url'
      ? NextResponse.json({ url: authUrl })
      : NextResponse.redirect(authUrl);
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
    ctx.log('error', 'Google connect start failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
