import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/ownerAuth';

const serviceSchema = z.object({
  name: z.string().min(1),
  durationMin: z.number().int().positive(),
  priceRange: z.string().optional(),
  bufferMin: z.number().int().nonnegative().optional()
});

const businessSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  contact: z.object({
    phone: z.string().min(1),
    email: z.string().optional(),
    address: z.string().optional()
  }),
  bookingMode: z.enum(['request', 'calendar']),
  services: z.array(serviceSchema).min(1)
});

function toConfig(row: any) {
  return {
    businessId: row.slug,
    name: row.name,
    timezone: row.timezone,
    hours: row.hours,
    services: row.services,
    policies: row.policies,
    contact: { phone: row.phone, email: row.email, address: row.address },
    faq: row.faqs,
    allowedDomains: Array.isArray(row.allowed_domains) ? row.allowed_domains : [],
    bookingMode: row.booking_mode,
    styling: row.widget_style
  };
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);

    const { data: ownerships, error: ownErr } = await supabase
      .from('business_owners')
      .select('business_id')
      .eq('owner_user_id', user.id);

    if (ownErr) {
      return NextResponse.json({
        error: `${ownErr.message}. Ensure table business_owners exists.`
      }, { status: 400 });
    }

    const ids = (ownerships || []).map((r: any) => r.business_id);
    if (!ids.length) return NextResponse.json({ businesses: [] });

    const { data: businesses, error: bizErr } = await supabase
      .from('businesses')
      .select('*')
      .in('id', ids)
      .order('updated_at', { ascending: false });

    if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 400 });
    return NextResponse.json({ businesses: (businesses || []).map(toConfig) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);
    const parsed = businessSchema.parse(await req.json());

    const record = {
      id: randomUUID(),
      slug: parsed.businessId,
      name: parsed.name,
      timezone: parsed.timezone,
      phone: parsed.contact.phone,
      email: parsed.contact.email || '',
      address: parsed.contact.address || '',
      hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      },
      services: parsed.services,
      allowed_domains: ['localhost', '127.0.0.1'],
      booking_mode: parsed.bookingMode,
      policies: {
        cancellation: 'Please provide at least 12 hours notice for cancellations.',
        booking: 'Walk-ins welcome, appointments recommended.'
      },
      faqs: {},
      slot_interval_min: 30,
      buffer_min: 10,
      booking_window_days: 30,
      widget_style: { accentColor: '#111827' },
      updated_at: new Date().toISOString()
    };

    const { data: business, error: upsertErr } = await supabase
      .from('businesses')
      .upsert(record, { onConflict: 'slug' })
      .select('id, slug, name, timezone, phone, email, address, hours, services, policies, faqs, allowed_domains, booking_mode, widget_style')
      .single();

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });

    const { error: ownerErr } = await supabase
      .from('business_owners')
      .upsert({ business_id: business.id, owner_user_id: user.id }, { onConflict: 'business_id,owner_user_id' });

    if (ownerErr) {
      return NextResponse.json({
        error: `${ownerErr.message}. Create business_owners table first.`
      }, { status: 400 });
    }

    return NextResponse.json({ business: toConfig(business) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
