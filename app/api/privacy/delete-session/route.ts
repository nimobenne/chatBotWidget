import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';

const schema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().min(1)
});

function isAuthed(req: NextRequest): boolean {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return false;
  const provided = req.headers.get('x-admin-password');
  return provided === pwd;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.parse(await req.json());
    await getStore().deleteConversationHistory(parsed.businessId, parsed.sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
