import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';
import { getStore } from '@/lib/store';
import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;

function oauthClient(refreshToken: string, tokenType: string, scope: string) {
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken, token_type: tokenType, scope });
  return client;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getSupabaseServiceClient();
    const store = getStore();

    const [{ data: businesses }, { data: billings }, { data: ownerships }, { data: bookings }] = await Promise.all([
      supabase.from('businesses').select('id, slug, name').order('created_at', { ascending: false }),
      supabase.from('business_billing').select('*'),
      supabase.from('business_owners').select('business_id, owner_user_id'),
      supabase.from('bookings').select('business_id, status, created_at')
    ]);

    const ownerIds = Array.from(new Set((ownerships || []).map((o: any) => o.owner_user_id)));
    const { data: owners } = ownerIds.length
      ? await supabase.from('owner_accounts').select('id, username').in('id', ownerIds)
      : { data: [] as any[] };
    const ownerById = new Map((owners || []).map((o: any) => [o.id, o.username]));

    const billingByBusinessId = new Map((billings || []).map((b: any) => [b.business_id, b]));
    const ownersByBusinessId = new Map<string, string>();
    for (const link of ownerships || []) {
      if (!ownersByBusinessId.has(link.business_id)) ownersByBusinessId.set(link.business_id, ownerById.get(link.owner_user_id) || '');
    }

    const now = Date.now();
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await Promise.all(
      (businesses || []).map(async (biz: any) => {
        const billing = billingByBusinessId.get(biz.id) || null;
        const confirmedTotal = (bookings || []).filter((b: any) => b.business_id === biz.id && b.status === 'confirmed').length;
        const confirmed30d = (bookings || []).filter((b: any) => b.business_id === biz.id && b.status === 'confirmed' && b.created_at >= since30).length;
        const threshold = Number(billing?.trial_booking_threshold || 5);
        const readyToInvoice = confirmedTotal >= threshold && ['trial_unpaid', 'pending_payment'].includes(billing?.billing_status || 'trial_unpaid');

        const config = await store.getBusinessConfig(biz.slug);
        const profileConfigured = !!(config?.services?.length && config?.contact?.phone);
        const ownerAssigned = !!ownersByBusinessId.get(biz.id);
        const conn = await store.getGoogleCalendarConnection(biz.slug);
        let calendarUsable = false;
        if (conn) {
          try {
            const auth = oauthClient(conn.refreshToken, conn.tokenType, conn.scope);
            const calendar = google.calendar({ version: 'v3', auth });
            await calendar.calendarList.list({ maxResults: 1 });
            calendarUsable = true;
          } catch {
            calendarUsable = false;
          }
        }

        const checklist = {
          profileConfigured,
          ownerAssigned,
          calendarUsable,
          testBookingPassed: !!billing?.checklist_test_booking_passed
        };
        const goLiveEligible = Object.values(checklist).every(Boolean);

        return {
          businessId: biz.slug,
          businessName: biz.name,
          ownerUsername: ownersByBusinessId.get(biz.id) || null,
          confirmedBookingsTotal: confirmedTotal,
          confirmedBookings30d: confirmed30d,
          threshold,
          thresholdProgress: `${confirmedTotal}/${threshold}`,
          readyToInvoice,
          billing: billing || {
            billing_status: 'trial_unpaid',
            plan_amount_eur: 50,
            setup_fee_eur: 99,
            setup_fee_waived: true,
            trial_booking_threshold: 5,
            paypal_email: null,
            paypal_subscription_id: null,
            notes: null,
            go_live_enabled: false,
            test_mode_enabled: false,
            checklist_test_booking_passed: false,
            next_billing_due_at: null,
            last_payment_at: null
          },
          checklist,
          goLiveEligible
        };
      })
    );

    return NextResponse.json({ clients: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
