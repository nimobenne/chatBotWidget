import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { requireOwner } from '@/lib/ownerAuth';
import { isAdminAuthed } from '@/lib/adminAuth';

const schema = z.object({ businessId: z.string().min(1) });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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
      if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 400 });
      const ownerBusinessIds = (ownershipRows || []).map((r: any) => r.business_id);
      if (!ownerBusinessIds.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const { data: ownedBiz, error: bizErr } = await supabase
        .from('businesses')
        .select('id')
        .in('id', ownerBusinessIds)
        .eq('slug', businessId)
        .limit(1);
      if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 400 });
      if (!ownedBiz || ownedBiz.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (!isAdminAuthed(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = getStore();
    const existing = await store.getGoogleCalendarConnection(businessId);
    if (!existing) {
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
    const message = revoked
      ? `Calendar disconnected and Google access revoked for ${businessId}.`
      : `Calendar disconnected for ${businessId}, but Google revoke did not confirm success.${revokeError ? ` ${revokeError}` : ''}`;
    return NextResponse.json({ ok: true, revoked, disconnected: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
