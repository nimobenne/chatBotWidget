import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { createBookingRecord } from '@/lib/booking';
import { sendBookingConfirmation } from '@/lib/email';
import { getRequestContext, extractOriginHost } from '@/lib/observability';
import { verifyWidgetToken } from '@/lib/widgetToken';

const schema = z.object({
  businessId: z.string().min(1),
  serviceName: z.string().min(1),
  startTimeISO: z.string().datetime(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional()
});

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req, 'POST /api/booking/create');
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

    const booking = await createBookingRecord({
      business,
      serviceName: parsed.serviceName,
      startTimeISO: parsed.startTimeISO,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone || parsed.customerEmail,
      customerEmail: parsed.customerEmail,
      status: 'confirmed'
    });

    await sendBookingConfirmation({
      to: parsed.customerEmail,
      customerName: parsed.customerName,
      serviceName: parsed.serviceName,
      dateTime: parsed.startTimeISO,
      businessName: business.name,
      businessAddress: business.contact.address,
      businessPhone: business.contact.phone
    }).catch(() => null);

    const res = NextResponse.json({
      bookingId: booking.bookingId,
      startTimeISO: booking.startTimeISO,
      message: 'Booking confirmed'
    });
    if (origin && host && (isSameHost || isAllowed)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    ctx.log('info', 'Booking created', { businessId: parsed.businessId, bookingId: booking.bookingId, serviceName: parsed.serviceName });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Booking creation failed', { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const OPTIONS = async (req: NextRequest) => {
  const origin = req.headers.get('origin') || '*';
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-widget-token');
  return res;
};
