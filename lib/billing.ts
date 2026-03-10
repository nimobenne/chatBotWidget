import { getSupabaseServiceClient } from './ownerCredentials';
import { sendAlertEmail } from './alerts';

export type BillingStatus = 'trial_unpaid' | 'pending_payment' | 'active_paid' | 'overdue' | 'cancelled';

export async function getBusinessBillingBySlug(businessId: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: business } = await supabase.from('businesses').select('id').eq('slug', businessId).single();
    if (!business) return null;
    const { data } = await supabase
      .from('business_billing')
      .select('*')
      .eq('business_id', business.id)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function getBookingBlockReason(businessId: string): Promise<string | null> {
  const billing = await getBusinessBillingBySlug(businessId);
  if (!billing) {
    await sendAlertEmail({
      severity: 'error',
      title: 'Billing row missing — bookings blocked',
      message: `No billing row found for business "${businessId}". All bookings are being blocked. Check the business_billing table.`,
      context: { businessId }
    }).catch(() => null);
    return 'Online booking is not configured yet. Please contact the business directly.';
  }
  if (billing.test_mode_enabled) return null;
  if (!billing.go_live_enabled) return 'Online booking is not live yet. Please contact the business directly.';
  if (billing.billing_status === 'cancelled') return 'Online booking is currently unavailable. Please call the business.';
  if (billing.billing_status === 'overdue') return 'Online booking is temporarily paused. Please call the business to book by phone.';
  return null;
}
