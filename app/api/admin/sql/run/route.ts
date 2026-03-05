import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';

const schema = z.object({ sql: z.string().min(1).max(30000) });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.parse(await req.json());
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase.rpc('admin_run_sql', { p_sql: parsed.sql });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.ok === false) return NextResponse.json({ error: data?.error || 'SQL execution failed' }, { status: 400 });

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
