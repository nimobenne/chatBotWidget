import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { BusinessConfig } from '@/lib/types';
import { isAdminAuthed } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const businesses = await getStore().listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const business = (await req.json()) as BusinessConfig;
  await getStore().saveBusinessConfig({ ...business, bookingMode: 'calendar' });
  return NextResponse.json({ ok: true });
}
