import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminPassword, issueAdminToken } from '@/lib/adminAuth';

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { password } = schema.parse(await req.json());
    if (password !== adminPassword()) {
      return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 });
    }
    return NextResponse.json({ token: issueAdminToken() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
