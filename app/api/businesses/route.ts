import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { BusinessConfig } from '@/lib/types';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await getStore().listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const business = (await req.json()) as BusinessConfig;

    try {
      await getStore().saveBusinessConfig({ ...business, bookingMode: 'calendar' });
      return NextResponse.json({ ok: true });
    } catch {
      const supabase = getSupabaseServiceClient();
      const sbRecord = {
        slug: business.businessId,
        name: business.name,
        timezone: business.timezone,
        hours: business.hours,
        services: business.services,
        policies: business.policies,
        phone: business.contact.phone,
        email: business.contact.email,
        address: business.contact.address,
        faqs: business.faq,
        allowed_domains: business.allowedDomains,
        booking_mode: 'calendar',
        slot_interval_min: 30,
        buffer_min: 10,
        booking_window_days: 30,
        widget_style: business.styling,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('businesses').upsert(sbRecord, { onConflict: 'slug' });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, store: 'service-role-fallback' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const deleteSchema = z.object({
  businessId: z.string().trim().min(1),
  confirmSlug: z.string().trim().min(1)
});

export async function DELETE(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = deleteSchema.parse(await req.json());
    if (parsed.businessId !== parsed.confirmSlug) {
      return NextResponse.json({ error: 'Confirmation slug mismatch' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: business, error: businessErr } = await supabase
      .from('businesses')
      .select('id, slug')
      .eq('slug', parsed.businessId)
      .single();
    if (businessErr || !business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const businessDbId = business.id;
    const deleteOps = [
      supabase.from('google_calendar_connections').delete().eq('business_id', businessDbId),
      supabase.from('business_owners').delete().eq('business_id', businessDbId),
      supabase.from('bookings').delete().eq('business_id', businessDbId),
      supabase.from('conversations').delete().eq('business_id', businessDbId),
      supabase.from('handoffs').delete().eq('business_id', businessDbId)
    ];

    for (const op of deleteOps) {
      const { error } = await op;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { error: deleteBusinessErr } = await supabase
      .from('businesses')
      .delete()
      .eq('id', businessDbId);
    if (deleteBusinessErr) return NextResponse.json({ error: deleteBusinessErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
