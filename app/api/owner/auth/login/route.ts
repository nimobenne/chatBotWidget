import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSupabaseServiceClient,
  issueOwnerToken,
  verifyOwnerPassword
} from '@/lib/ownerCredentials';
import { validateOwnerPasswordPolicy } from '@/lib/passwordPolicy';

const schema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(200)
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function getSecurityRow(supabase: any, username: string) {
  const { data } = await supabase
    .from('owner_login_security')
    .select('username, failed_count, locked_until')
    .eq('username', username)
    .single();
  return data || null;
}

async function recordFailedAttempt(supabase: any, username: string, currentFailedCount: number) {
  const nextFailed = currentFailedCount + 1;
  const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  await supabase
    .from('owner_login_security')
    .upsert({
      username,
      failed_count: shouldLock ? 0 : nextFailed,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString()
    }, { onConflict: 'username' });

  return { shouldLock, lockedUntil };
}

async function clearFailedAttempts(supabase: any, username: string) {
  await supabase
    .from('owner_login_security')
    .upsert({
      username,
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'username' });
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json());
    const supabase = getSupabaseServiceClient();
    const username = parsed.username.toLowerCase();

    const security = await getSecurityRow(supabase, username);
    if (security?.locked_until && new Date(security.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ error: 'Too many failed attempts. Please try again later.' }, { status: 429 });
    }

    const { data: owner, error } = await supabase
      .from('owner_accounts')
      .select('id, username, password_hash, is_active')
      .eq('username', username)
      .single();

    if (error || !owner || owner.is_active === false) {
      await recordFailedAttempt(supabase, username, security?.failed_count || 0);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const ok = verifyOwnerPassword(parsed.password, owner.password_hash || '');
    if (!ok) {
      await recordFailedAttempt(supabase, username, security?.failed_count || 0);
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const { data: ownerLinks } = await supabase
      .from('business_owners')
      .select('business_id')
      .eq('owner_user_id', owner.id)
      .limit(20);
    const businessIds = (ownerLinks || []).map((r: any) => r.business_id);
    if (businessIds.length) {
      const { data: billingRows } = await supabase
        .from('business_billing')
        .select('billing_status')
        .in('business_id', businessIds)
        .limit(20);
      const hasCancelled = (billingRows || []).some((r: any) => r.billing_status === 'cancelled');
      if (hasCancelled) {
        return NextResponse.json({ error: 'Owner portal access is disabled for this business. Contact support.' }, { status: 403 });
      }
    }

    const policyError = validateOwnerPasswordPolicy(parsed.password);
    if (policyError) {
      return NextResponse.json({ error: `Password policy update required: ${policyError}` }, { status: 403 });
    }

    await clearFailedAttempts(supabase, username);

    const token = issueOwnerToken(owner.id);
    return NextResponse.json({ token, owner: { id: owner.id, username: owner.username } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
