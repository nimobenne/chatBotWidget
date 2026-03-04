import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    const { data: business } = await supabase.from('businesses').select('id, slug, name').eq('slug', businessId).single();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const { data: ownership, error: ownErr } = await supabase
      .from('business_owners')
      .select('business_id')
      .eq('business_id', business.id)
      .eq('owner_user_id', user.id)
      .single();
    if (ownErr || !ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sinceISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: bookings }, { data: conversations }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, service, start_time, customer_name, customer_email, status, created_at, calendar_event_id')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('conversations')
        .select('id, created_at')
        .eq('business_id', business.id)
        .gte('created_at', sinceISO)
    ]);

    const confirmed = (bookings || []).filter((b: any) => b.status === 'confirmed').length;
    const convCount = (conversations || []).length;
    const calendarSynced = (bookings || []).filter((b: any) => !!b.calendar_event_id).length;

    const topServicesMap = new Map<string, number>();
    for (const b of bookings || []) {
      topServicesMap.set(b.service, (topServicesMap.get(b.service) || 0) + 1);
    }
    const topServices = Array.from(topServicesMap.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const daysMap = new Map<string, { date: string; bookings: number; conversations: number }>();
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      daysMap.set(key, { date: key, bookings: 0, conversations: 0 });
    }
    for (const b of bookings || []) {
      const key = String(b.created_at || '').slice(0, 10);
      const row = daysMap.get(key);
      if (row) row.bookings += 1;
    }
    for (const c of conversations || []) {
      const key = String(c.created_at || '').slice(0, 10);
      const row = daysMap.get(key);
      if (row) row.conversations += 1;
    }

    return NextResponse.json({
      business: { slug: business.slug, name: business.name },
      metrics: {
        bookings30d: bookings?.length || 0,
        confirmed30d: confirmed,
        calendarSynced30d: calendarSynced,
        conversations30d: convCount,
        conversionRate: convCount ? Math.round((confirmed / convCount) * 100) : 0
      },
      topServices,
      dailySeries: Array.from(daysMap.values()),
      recentBookings: bookings || []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
