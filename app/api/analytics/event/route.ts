import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  businessId: z.string().min(1),
  sessionId: z.string().min(1),
  event: z.string().min(1),
  meta: z.record(z.any()).optional()
});

export async function POST(req: NextRequest) {
  try {
    const payload = schema.parse(await req.json());
    console.log('[widget-event]', {
      at: new Date().toISOString(),
      businessId: payload.businessId,
      sessionId: payload.sessionId,
      event: payload.event,
      meta: payload.meta || {}
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
