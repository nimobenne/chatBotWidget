import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseStore } from '@/lib/store.supabase';

export const runtime = 'nodejs';

function authed(req: NextRequest): boolean {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const provided = req.headers.get('x-admin-password') || req.nextUrl.searchParams.get('password');
  return provided === pwd;
}

export async function GET(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Admin disabled' }, { status: 404 });
  }
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await getSupabaseStore().listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Admin disabled' }, { status: 404 });
  }
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  void req;
  return NextResponse.json({ error: 'Editing businesses from this endpoint is not implemented for Supabase yet.' }, { status: 501 });
}
