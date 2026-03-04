import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { getAvailableSlots } from '@/lib/booking';

const schema = z.object({
  businessId: z.string().min(1),
  serviceName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json());
    const store = getStore();
    const business = await store.getBusinessConfig(parsed.businessId);
    if (!business) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const slots = await getAvailableSlots(business, parsed.serviceName, {
      start: `${parsed.date}T00:00:00.000Z`,
      end: `${parsed.date}T23:59:59.999Z`
    });

    return NextResponse.json({ slots, timezone: business.timezone });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
