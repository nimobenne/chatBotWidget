import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';

function parsePriceMidpoint(priceRange?: string): number | null {
  if (!priceRange) return null;
  const nums = priceRange
    .replace(/,/g, '.')
    .match(/\d+(?:\.\d+)?/g)
    ?.map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length === 0) return null;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

function toMinutes(hhmm?: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function localWeekdayAndMinutes(iso: string, timeZone: string): { weekday: string; minutes: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday').toLowerCase();
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { weekday, minutes: hour * 60 + minute };
}

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    const { data: business } = await supabase
      .from('businesses')
      .select('id, slug, name, timezone, services, hours')
      .eq('slug', businessId)
      .single();
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
        .limit(500),
      supabase
        .from('conversations')
        .select('id, created_at')
        .eq('business_id', business.id)
        .gte('created_at', sinceISO)
    ]);

    const confirmed = (bookings || []).filter((b: any) => b.status === 'confirmed').length;
    const convCount = (conversations || []).length;
    const calendarSynced = (bookings || []).filter((b: any) => !!b.calendar_event_id).length;

    const confirmedBookings = (bookings || []).filter((b: any) => b.status === 'confirmed');
    const serviceValues = new Map<string, number>();
    for (const s of (business.services || []) as any[]) {
      const midpoint = parsePriceMidpoint(s?.priceRange);
      if (midpoint) serviceValues.set(String(s.name || ''), midpoint);
    }
    const fallbackTicket = 35;
    const estimatedRevenue30d = confirmedBookings.reduce((sum: number, b: any) => {
      const val = serviceValues.get(String(b.service || '')) || fallbackTicket;
      return sum + val;
    }, 0);
    const avgTicket = confirmedBookings.length ? estimatedRevenue30d / confirmedBookings.length : fallbackTicket;

    const hours = (business.hours || {}) as Record<string, { open: string; close: string } | null>;
    const afterHoursBookings30d = confirmedBookings.filter((b: any) => {
      const local = localWeekdayAndMinutes(String(b.created_at || ''), String(business.timezone || 'America/New_York'));
      if (!local) return false;
      const rule = hours[local.weekday];
      if (!rule) return true;
      const open = toMinutes(rule.open);
      const close = toMinutes(rule.close);
      if (open === null || close === null) return true;
      return local.minutes < open || local.minutes >= close;
    }).length;

    const estimatedCallsSaved30d = Math.max(0, Math.round(convCount * 0.55));

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

    const { data: billing } = await supabase
      .from('business_billing')
      .select('billing_status, trial_booking_threshold, go_live_enabled, test_mode_enabled, plan_amount_eur')
      .eq('business_id', business.id)
      .single();

    const monthlyCostEur = Number(billing?.plan_amount_eur || 50);
    const roiMultiple = monthlyCostEur > 0 ? estimatedRevenue30d / monthlyCostEur : 0;
    const bookingsToCoverCost = Math.max(1, Math.ceil(monthlyCostEur / Math.max(avgTicket, 1)));

    return NextResponse.json({
      business: { slug: business.slug, name: business.name },
      billing: {
        status: billing?.billing_status || 'trial_unpaid',
        threshold: billing?.trial_booking_threshold || 5,
        monthlyCostEur,
        goLiveEnabled: !!billing?.go_live_enabled,
        testModeEnabled: !!billing?.test_mode_enabled,
        warning: billing?.billing_status === 'overdue'
          ? 'Billing is overdue. Online booking may be paused.'
          : billing?.billing_status === 'cancelled'
            ? 'Billing is cancelled. Access may be restricted.'
            : null
      },
      metrics: {
        bookings30d: bookings?.length || 0,
        confirmed30d: confirmed,
        calendarSynced30d: calendarSynced,
        conversations30d: convCount,
        conversionRate: convCount ? Math.round((confirmed / convCount) * 100) : 0
      },
      roi: {
        estimatedRevenue30d: Math.round(estimatedRevenue30d),
        monthlyCostEur,
        roiMultiple: Number(roiMultiple.toFixed(2)),
        bookingsToCoverCost,
        estimatedCallsSaved30d,
        afterHoursBookings30d,
        avgTicket: Math.round(avgTicket)
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
