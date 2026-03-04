import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { createBookingRecord } from '@/lib/booking';
import { createCalendarEvent } from '@/lib/calendar';
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

    const booking = await createBookingRecord({
      business,
      serviceName: parsed.serviceName,
      startTimeISO: parsed.startTimeISO,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone || parsed.customerEmail,
      customerEmail: parsed.customerEmail,
      status: 'confirmed'
    });

    await createCalendarEvent(booking, business).catch(() => null);
    await sendBookingConfirmation({
      to: parsed.customerEmail,
      customerName: parsed.customerName,
      serviceName: parsed.serviceName,
      dateTime: parsed.startTimeISO,
      businessName: business.name,
      businessAddress: business.contact.address,
      businessPhone: business.contact.phone
    }).catch(() => null);

    return NextResponse.json({
      bookingId: booking.bookingId,
      startTimeISO: booking.startTimeISO,
      message: 'Booking confirmed'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
