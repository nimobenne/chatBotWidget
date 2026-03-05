import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/calendar';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed, verifyAdminToken } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const store = getStore();
    const existingConn = await store.getGoogleCalendarConnection(businessId);
    if (existingConn) {
      if (!reconnect) {
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
