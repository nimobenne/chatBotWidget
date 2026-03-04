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
  bookingMode: z.literal('calendar').default('calendar'),
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
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (ownErr) {
      return NextResponse.json({
        error: `${ownErr.message}. Ensure table business_owners exists.`
      }, { status: 400 });
    }

    const ids = (ownerships || []).map((r: any) => r.business_id);

    const { data: requests } = await supabase
      .from('business_intake_requests')
      .select('id, status, created_at, approved_at, payload')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!ids.length) return NextResponse.json({ businesses: [], intakeRequests: requests || [] });

    const assignedBusinessId = ids[0];

    const { data: businesses, error: bizErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', assignedBusinessId)
      .order('updated_at', { ascending: false });

    if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 400 });
    return NextResponse.json({ businesses: (businesses || []).map(toConfig), intakeRequests: requests || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);
    const parsed = businessSchema.parse(await req.json());

    const payload = {
      ...parsed,
      hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      },
      allowedDomains: ['localhost', '127.0.0.1'],
      policies: {
        cancellation: 'Please provide at least 12 hours notice for cancellations.',
        booking: 'Walk-ins welcome, appointments recommended.'
      },
      faq: {},
      styling: { accentColor: '#111827' }
    };

    const { data: request, error: requestErr } = await supabase
      .from('business_intake_requests')
      .insert({ owner_user_id: user.id, payload, status: 'pending' })
      .select('id, status, created_at')
      .single();

    if (requestErr) {
      return NextResponse.json({ error: `${requestErr.message}. Create business_intake_requests table first.` }, { status: 400 });
    }

    return NextResponse.json({ intakeRequest: request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
