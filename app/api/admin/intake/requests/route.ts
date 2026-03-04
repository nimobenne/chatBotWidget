import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'password';
}

function authed(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-password');
  return provided === adminPassword();
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials are not configured');
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('business_intake_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
