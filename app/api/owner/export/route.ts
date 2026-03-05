import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/ownerAuth';
import { toCsv } from '@/lib/csv';

const schema = z.object({
  type: z.enum(['bookings', 'handoffs']),
  businessId: z.string().min(1)
});

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);
    const parsed = schema.parse({
      type: req.nextUrl.searchParams.get('type') || 'bookings',
      businessId: req.nextUrl.searchParams.get('businessId') || ''
    });

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
      .select('id, slug')
      .in('id', ownerBusinessIds)
      .eq('slug', parsed.businessId)
      .limit(1);
    if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 400 });
    if (!ownedBiz || ownedBiz.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const businessDbId = ownedBiz[0].id;

    if (parsed.type === 'bookings') {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,service,start_time,end_time,customer_name,customer_phone,customer_email,status,notes,calendar_event_id,created_at')
        .eq('business_id', businessDbId)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = (data || []).map((r: any) => ({
        booking_id: r.id,
        business_id: parsed.businessId,
        service: r.service,
        start_time: r.start_time,
        end_time: r.end_time,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        status: r.status,
        notes: r.notes,
        calendar_event_id: r.calendar_event_id,
        created_at: r.created_at
      }));
      const csv = toCsv(Object.keys(rows[0] || {
        booking_id: '', business_id: '', service: '', start_time: '', end_time: '', customer_name: '', customer_phone: '', customer_email: '', status: '', notes: '', calendar_event_id: '', created_at: ''
      }), rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bookings_${parsed.businessId}.csv"`
        }
      });
    }

    const { data, error } = await supabase
      .from('handoffs')
      .select('id,summary,customer_contact,status,channel,last_user_message,created_at,resolved_at')
      .eq('business_id', businessDbId)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const rows = (data || []).map((r: any) => ({
      handoff_id: r.id,
      business_id: parsed.businessId,
      summary: r.summary,
      customer_contact: JSON.stringify(r.customer_contact || {}),
      status: r.status,
      channel: r.channel,
      last_user_message: r.last_user_message,
      created_at: r.created_at,
      resolved_at: r.resolved_at
    }));
    const csv = toCsv(Object.keys(rows[0] || {
      handoff_id: '', business_id: '', summary: '', customer_contact: '', status: '', channel: '', last_user_message: '', created_at: '', resolved_at: ''
    }), rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="handoffs_${parsed.businessId}.csv"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
