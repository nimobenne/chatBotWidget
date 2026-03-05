import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';
import { logAdminAudit } from '@/lib/adminAudit';
import { getStore } from '@/lib/store';
import { getAvailableSlots } from '@/lib/booking';

const patchSchema = z.object({
  businessId: z.string().min(1),
  action: z.enum([
    'set_pending_payment',
    'mark_paid',
    'set_overdue',
    'cancel',
    'reactivate',
    'update_fields',
    'toggle_test_mode',
    'run_test_booking_check',
    'set_go_live'
  ]),
  fields: z.object({
    plan_amount_eur: z.number().int().min(0).optional(),
    setup_fee_eur: z.number().int().min(0).optional(),
    setup_fee_waived: z.boolean().optional(),
    trial_booking_threshold: z.number().int().min(1).max(100).optional(),
    paypal_email: z.string().email().optional().or(z.literal('')),
    paypal_subscription_id: z.string().optional(),
    notes: z.string().optional(),
    next_billing_due_at: z.string().datetime().optional().or(z.literal(''))
  }).optional(),
  testModeEnabled: z.boolean().optional(),
  goLiveEnabled: z.boolean().optional()
});

async function ensureBillingRow(supabase: any, businessDbId: string) {
  const { data } = await supabase.from('business_billing').select('*').eq('business_id', businessDbId).single();
  if (data) return data;
  const { data: inserted, error } = await supabase
    .from('business_billing')
    .insert({ business_id: businessDbId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return inserted;
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = patchSchema.parse(await req.json());
    const supabase = getSupabaseServiceClient();
    const { data: biz } = await supabase.from('businesses').select('id, slug').eq('slug', parsed.businessId).single();
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const billing = await ensureBillingRow(supabase, biz.id);

    if (parsed.action === 'set_pending_payment') {
      await supabase.from('business_billing').update({ billing_status: 'pending_payment', updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }
    if (parsed.action === 'mark_paid') {
      const now = new Date();
      const next = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('business_billing').update({
        billing_status: 'active_paid',
        billing_started_at: billing.billing_started_at || now.toISOString(),
        last_payment_at: now.toISOString(),
        next_billing_due_at: next,
        updated_at: now.toISOString()
      }).eq('business_id', biz.id);
    }
    if (parsed.action === 'set_overdue') {
      await supabase.from('business_billing').update({ billing_status: 'overdue', updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }
    if (parsed.action === 'cancel') {
      await supabase.from('business_billing').update({ billing_status: 'cancelled', updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }
    if (parsed.action === 'reactivate') {
      await supabase.from('business_billing').update({ billing_status: 'active_paid', updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }
    if (parsed.action === 'update_fields') {
      const f = parsed.fields || {};
      const patch = {
        ...(typeof f.plan_amount_eur === 'number' ? { plan_amount_eur: f.plan_amount_eur } : {}),
        ...(typeof f.setup_fee_eur === 'number' ? { setup_fee_eur: f.setup_fee_eur } : {}),
        ...(typeof f.setup_fee_waived === 'boolean' ? { setup_fee_waived: f.setup_fee_waived } : {}),
        ...(typeof f.trial_booking_threshold === 'number' ? { trial_booking_threshold: f.trial_booking_threshold } : {}),
        ...(typeof f.paypal_email === 'string' ? { paypal_email: f.paypal_email || null } : {}),
        ...(typeof f.paypal_subscription_id === 'string' ? { paypal_subscription_id: f.paypal_subscription_id || null } : {}),
        ...(typeof f.notes === 'string' ? { notes: f.notes || null } : {}),
        ...(typeof f.next_billing_due_at === 'string' ? { next_billing_due_at: f.next_billing_due_at || null } : {}),
        updated_at: new Date().toISOString()
      };
      await supabase.from('business_billing').update(patch).eq('business_id', biz.id);
    }
    if (parsed.action === 'toggle_test_mode') {
      await supabase.from('business_billing').update({ test_mode_enabled: !!parsed.testModeEnabled, updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }
    if (parsed.action === 'run_test_booking_check') {
      const business = await getStore().getBusinessConfig(parsed.businessId);
      let passed = false;
      if (business && business.services?.length) {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const slots = await getAvailableSlots(business, business.services[0].name, {
          start: `${tomorrow}T00:00:00`,
          end: `${tomorrow}T23:59:59`
        });
        passed = Array.isArray(slots);
      }
      await supabase
        .from('business_billing')
        .update({ checklist_test_booking_passed: passed, updated_at: new Date().toISOString() })
        .eq('business_id', biz.id);
    }
    if (parsed.action === 'set_go_live') {
      const { data: links } = await supabase.from('business_owners').select('owner_user_id').eq('business_id', biz.id).limit(1);
      const hasOwner = !!(links && links.length);
      const conn = await getStore().getGoogleCalendarConnection(parsed.businessId);
      const { data: refreshed } = await supabase.from('business_billing').select('checklist_test_booking_passed, test_mode_enabled').eq('business_id', biz.id).single();
      const canGoLive = hasOwner && !!conn && !!refreshed?.checklist_test_booking_passed;
      if (!canGoLive && !refreshed?.test_mode_enabled && parsed.goLiveEnabled) {
        return NextResponse.json({ error: 'Checklist incomplete. Run setup checks before enabling go-live.' }, { status: 400 });
      }
      await supabase.from('business_billing').update({ go_live_enabled: !!parsed.goLiveEnabled, updated_at: new Date().toISOString() }).eq('business_id', biz.id);
    }

    await logAdminAudit(req, {
      action: `billing_${parsed.action}`,
      targetType: 'business',
      targetId: parsed.businessId,
      meta: { fields: parsed.fields || null, testModeEnabled: parsed.testModeEnabled, goLiveEnabled: parsed.goLiveEnabled }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
