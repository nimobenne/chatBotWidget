import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';
import { toCsv } from '@/lib/csv';

const schema = z.object({
  type: z.enum(['bookings', 'handoffs']),
  businessId: z.string().optional()
});

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.parse({
      type: req.nextUrl.searchParams.get('type') || 'bookings',
      businessId: req.nextUrl.searchParams.get('businessId') || undefined
    });

    const supabase = getSupabaseServiceClient();
    const { data: bizRows } = await supabase.from('businesses').select('id, slug');
    const bizById = new Map<string, string>((bizRows || []).map((b: any) => [b.id, b.slug]));
    const targetBizId = parsed.businessId
      ? (bizRows || []).find((b: any) => b.slug === parsed.businessId)?.id
      : null;
    if (parsed.businessId && !targetBizId) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    if (parsed.type === 'bookings') {
      let query = supabase
        .from('bookings')
        .select('id,business_id,service,start_time,end_time,customer_name,customer_phone,customer_email,status,notes,calendar_event_id,created_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (targetBizId) query = query.eq('business_id', targetBizId);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const rows = (data || []).map((r: any) => ({
        booking_id: r.id,
        business_id: bizById.get(r.business_id) || r.business_id,
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
          'Content-Disposition': `attachment; filename="bookings_${parsed.businessId || 'all'}.csv"`
        }
      });
    }

    let query = supabase
      .from('handoffs')
      .select('id,business_id,customer_contact,summary,status,channel,last_user_message,created_at,resolved_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (targetBizId) query = query.eq('business_id', targetBizId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const rows = (data || []).map((r: any) => ({
      handoff_id: r.id,
      business_id: bizById.get(r.business_id) || r.business_id,
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
        'Content-Disposition': `attachment; filename="handoffs_${parsed.businessId || 'all'}.csv"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
