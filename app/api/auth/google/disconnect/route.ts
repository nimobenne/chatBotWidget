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
      const { data: business } = await supabase.from('businesses').select('id').eq('slug', businessId).single();
      if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
      const { data: ownership } = await supabase
        .from('business_owners')
        .select('business_id')
        .eq('business_id', business.id)
        .eq('owner_user_id', user.id)
        .single();
      if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (!isAdminAuthed(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await getStore().removeGoogleCalendarConnection(businessId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
