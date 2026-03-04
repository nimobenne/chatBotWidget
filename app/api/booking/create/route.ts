import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { createBookingRecord } from '@/lib/booking';
import { sendBookingConfirmation } from '@/lib/email';

const schema = z.object({
  businessId: z.string().min(1),
  serviceName: z.string().min(1),
  startTimeISO: z.string().datetime(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional()
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
