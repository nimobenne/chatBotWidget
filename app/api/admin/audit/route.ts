import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ logs: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
