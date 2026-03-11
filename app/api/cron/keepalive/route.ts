import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkCalendarHealth } from '@/lib/calendar';
import { sendAlertEmail } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

const CONVERSATION_RETENTION_DAYS = 90;
const IDEMPOTENCY_KEY_RETENTION_DAYS = 30;

export async function GET() {
  // 1. Keepalive ping (anon key)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await anonClient.from('businesses').select('id').limit(1);

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Prune old conversations (>90 days)
  let conversationsPruned = 0;
  let keysPruned = 0;
  try {
    const cutoff = new Date(Date.now() - CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from('conversations')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);
    conversationsPruned = count || 0;
  } catch (err) {
    console.error('Conversation pruning failed:', err);
  }

  // 3. Prune old idempotency keys (>30 days)
  try {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_KEY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from('booking_idempotency_keys')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);
    keysPruned = count || 0;
  } catch (err) {
    console.error('Idempotency key pruning failed:', err);
  }

  // 4. Calendar health checks
  const healthResults: Record<string, string> = {};
  try {
    const { data: connections } = await serviceClient
      .from('google_calendar_connections')
      .select('business_id');

    if (connections?.length) {
      // Resolve business slugs
      const businessIds = connections.map(c => c.business_id);
      const { data: businesses } = await serviceClient
        .from('businesses')
        .select('id, slug')
        .in('id', businessIds);

      for (const biz of businesses || []) {
        const health = await checkCalendarHealth(biz.slug);
        healthResults[biz.slug] = health.healthy ? 'healthy' : `${health.errorType}: ${health.errorMessage}`;
        if (!health.healthy && health.errorType === 'auth_revoked') {
          await sendAlertEmail({
            severity: 'error',
            title: `Calendar disconnected — ${biz.slug}`,
            message: `The Google Calendar connection for "${biz.slug}" is broken: ${health.errorMessage}. The owner needs to reconnect.`,
            context: { businessSlug: biz.slug, errorType: health.errorType }
          }).catch(() => null);
        }
      }
    }
  } catch (err) {
    console.error('Calendar health check failed:', err);
  }

  return NextResponse.json({
    ok: true,
    pruned: { conversations: conversationsPruned, idempotencyKeys: keysPruned },
    calendarHealth: healthResults
  });
}
