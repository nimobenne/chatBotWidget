import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { BusinessConfig } from '@/lib/types';

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'password';
}

function authed(req: NextRequest): boolean {
  const pwd = adminPassword();
  const headerPwd = req.headers.get('x-admin-password');
  const queryPwd = process.env.NODE_ENV === 'production' ? null : req.nextUrl.searchParams.get('password');
  const provided = headerPwd || queryPwd;
  return provided === pwd;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await getStore().listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const business = (await req.json()) as BusinessConfig;
  await getStore().saveBusinessConfig(business);
  return NextResponse.json({ ok: true });
}
