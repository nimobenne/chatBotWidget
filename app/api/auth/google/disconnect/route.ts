import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getRequestContext } from '@/lib/observability';

const schema = z.object({ businessId: z.string().min(1) });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req, 'POST /api/auth/google/disconnect');
  try {
    const { businessId } = schema.parse(await req.json());
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = authHeader.startsWith('Bearer ');

    if (hasBearer) {
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
    } else if (!isAdminAuthed(req)) {
      ctx.log('warn', 'Google disconnect unauthorized', { reason: 'missing_admin_auth', businessId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = getStore();
    const existing = await store.getGoogleCalendarConnection(businessId);
    if (!existing) {
      ctx.log('info', 'No connected calendar found to disconnect', { businessId });
      return NextResponse.json({ ok: true, revoked: false, disconnected: false, message: 'No connected calendar found.' });
    }

    let revoked = false;
    let revokeError = '';
    try {
      const body = new URLSearchParams({ token: existing.refreshToken });
      const res = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      revoked = res.ok;
      if (!res.ok) {
        revokeError = `Google revoke failed (${res.status})`;
      }
    } catch (error) {
      revokeError = error instanceof Error ? error.message : 'Google revoke failed';
    }

    await store.removeGoogleCalendarConnection(businessId);
    ctx.log('info', 'Calendar disconnected', { businessId, revoked });
    const message = revoked
      ? `Calendar disconnected and Google access revoked for ${businessId}.`
      : `Calendar disconnected for ${businessId}, but Google revoke did not confirm success.${revokeError ? ` ${revokeError}` : ''}`;
    return NextResponse.json({ ok: true, revoked, disconnected: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Google disconnect failed', { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
