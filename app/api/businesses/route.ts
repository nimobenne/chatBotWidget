import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { BusinessConfig } from '@/lib/types';

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
  const businesses = await getStore().listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Admin disabled' }, { status: 404 });
  }
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const business = (await req.json()) as BusinessConfig;
  await getStore().saveBusinessConfig(business);
  return NextResponse.json({ ok: true });
}
