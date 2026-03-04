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

    const origin = req.headers.get('origin');
    const host = origin ? new URL(origin).hostname : '';
    const isSameHost = host && host === req.nextUrl.hostname;
    const isAllowed = host && business.allowedDomains.some((d) => {
      const rule = d.toLowerCase().trim();
      const normalized = host.toLowerCase();
      if (!rule) return false;
      if (rule === '*') return true;
      if (rule.startsWith('*.')) return normalized.endsWith(rule.slice(1));
      return normalized === rule;
    });
    if (host && !isSameHost && !isAllowed) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const slots = await getAvailableSlots(business, parsed.serviceName, {
      start: `${parsed.date}T00:00:00.000Z`,
      end: `${parsed.date}T23:59:59.999Z`
    });

    const res = NextResponse.json({ slots, timezone: business.timezone });
    if (origin && host && (isSameHost || isAllowed)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const OPTIONS = async (req: NextRequest) => {
  const origin = req.headers.get('origin') || '*';
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
};
