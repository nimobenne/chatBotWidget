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
        .select('id, service, start_time, customer_name, customer_email, status, created_at')
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

    return NextResponse.json({
      business: { slug: business.slug, name: business.name },
      metrics: {
        bookings30d: bookings?.length || 0,
        confirmed30d: confirmed,
        conversations30d: convCount,
        conversionRate: convCount ? Math.round((confirmed / convCount) * 100) : 0
      },
      recentBookings: bookings || []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
