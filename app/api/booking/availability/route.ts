import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { getAvailableSlots } from '@/lib/booking';
import { getRequestContext, extractOriginHost } from '@/lib/observability';
import { verifyWidgetToken } from '@/lib/widgetToken';

const schema = z.object({
  businessId: z.string().min(1),
  serviceName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req, 'POST /api/booking/availability');
  try {
    const parsed = schema.parse(await req.json());
    const store = getStore();
    const business = await store.getBusinessConfig(parsed.businessId);
    if (!business) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const origin = req.headers.get('origin');
    const host = extractOriginHost(req);
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
      ctx.log('warn', 'Origin blocked', { businessId: parsed.businessId, host });
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const token = req.headers.get('x-widget-token');
    const tokenCheck = verifyWidgetToken(token, { businessId: parsed.businessId, host: host || req.nextUrl.hostname });
    if (!tokenCheck.ok) {
      ctx.log('warn', 'Widget token rejected', { businessId: parsed.businessId, reason: tokenCheck.reason });
      return NextResponse.json({ error: `Unauthorized widget request: ${tokenCheck.reason}` }, { status: 401 });
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
    ctx.log('info', 'Availability calculated', { businessId: parsed.businessId, service: parsed.serviceName, date: parsed.date, slotCount: slots.length });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Availability failed', { error: message });
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
