import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const schema = z.object({ requestId: z.string().uuid() });

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'password';
}

function authed(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  return provided === adminPassword();
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials are not configured');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { requestId } = schema.parse(await req.json());
    const supabase = getSupabase();

    const { data: intake, error: intakeErr } = await supabase
      .from('business_intake_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (intakeErr || !intake) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const draft = intake.payload || {};
    const businessSlug = String(draft.businessId || '').trim();
    if (!businessSlug) return NextResponse.json({ error: 'Invalid businessId in intake' }, { status: 400 });

    const businessRow = {
      id: randomUUID(),
      slug: businessSlug,
      name: String(draft.name || 'New Business'),
      timezone: String(draft.timezone || 'America/New_York'),
      phone: String(draft.contact?.phone || ''),
      email: String(draft.contact?.email || ''),
      address: String(draft.contact?.address || ''),
      hours: draft.hours || {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      },
      services: draft.services || [],
      allowed_domains: Array.isArray(draft.allowedDomains) ? draft.allowedDomains : ['localhost', '127.0.0.1'],
      booking_mode: draft.bookingMode || 'calendar',
      policies: draft.policies || { cancellation: '', booking: '' },
      faqs: draft.faq || {},
      slot_interval_min: 30,
      buffer_min: 10,
      booking_window_days: 30,
      widget_style: draft.styling || { accentColor: '#111827' },
      updated_at: new Date().toISOString()
    };

    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .upsert(businessRow, { onConflict: 'slug' })
      .select('id, slug')
      .single();
    if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 400 });

    if (intake.owner_user_id) {
      await supabase
        .from('business_owners')
        .upsert({ business_id: business.id, owner_user_id: intake.owner_user_id }, { onConflict: 'business_id,owner_user_id' });
    }

    const { error: updErr } = await supabase
      .from('business_intake_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', requestId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, businessSlug: business.slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
