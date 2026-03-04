import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { isAdminAuthed } from '@/lib/adminAuth';

const schema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().min(1)
});

export async function POST(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.parse(await req.json());
    await getStore().deleteConversationHistory(parsed.businessId, parsed.sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
