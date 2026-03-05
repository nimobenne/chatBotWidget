import { getStore } from './store';
import { BookingRecord, BusinessConfig, Service } from './types';
import { createCalendarEvent } from './calendar';
import { getCalendarBusyRanges } from './calendar';
import { sendAlertEmail } from './alerts';
import { getBookingBlockReason } from './billing';

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = dtf.formatToParts(date);
  const vals: Record<string, string> = {};
  for (const part of parts) vals[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(vals.year),
    Number(vals.month) - 1,
    Number(vals.day),
    Number(vals.hour),
    Number(vals.minute),
    Number(vals.second)
  );
  return asUTC - date.getTime();
}

function zonedLocalToUtc(dateYmd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  let utcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  let offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  utcMs -= offset;
  offset = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  utcMs = Date.UTC(y, m - 1, d, hh, mm, 0) - offset;
  return new Date(utcMs);
}

function addDaysYmd(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function localWeekday(dateYmd: string, timeZone: string): string {
  const middayUtc = zonedLocalToUtc(dateYmd, '12:00', timeZone);
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(middayUtc).toLowerCase();
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function findService(business: BusinessConfig, serviceName: string): Service {
  const service = business.services.find((s) => s.name.toLowerCase() === serviceName.toLowerCase());
  if (!service) {
    throw new Error(`Unknown service: ${serviceName}`);
  }
  return service;
}

export async function getAvailableSlots(business: BusinessConfig, serviceName: string, dateRangeISO: { start: string; end: string }): Promise<string[]> {
  const store = getStore();
  const service = findService(business, serviceName);
  const existing = await store.listBookings(business.businessId);
  const startYmd = String(dateRangeISO.start).slice(0, 10);
  const endYmd = String(dateRangeISO.end).slice(0, 10);
  const calendarRangeStart = zonedLocalToUtc(startYmd, '00:00', business.timezone).toISOString();
  const calendarRangeEnd = zonedLocalToUtc(endYmd, '23:59', business.timezone).toISOString();
  const busyInCalendar = await getCalendarBusyRanges(business, calendarRangeStart, calendarRangeEnd);
  const slots: string[] = [];

  let dayYmd = startYmd;
  while (dayYmd <= endYmd) {
    const weekday = localWeekday(dayYmd, business.timezone);
    const rule = business.hours[weekday];
    if (!rule) {
      dayYmd = addDaysYmd(dayYmd, 1);
      continue;
    }

    const open = zonedLocalToUtc(dayYmd, rule.open, business.timezone);
    const close = zonedLocalToUtc(dayYmd, rule.close, business.timezone);
    const step = 30;
    for (let cursor = new Date(open); cursor < close; cursor.setMinutes(cursor.getMinutes() + step)) {
      const start = new Date(cursor);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + service.durationMin + (service.bufferMin ?? 0));
      if (end > close) continue;
      const bookingConflict = existing.some((b: BookingRecord) => overlaps(start, end, new Date(b.startTimeISO), new Date(b.endTimeISO)));
      const calendarConflict = busyInCalendar.some((b) => overlaps(start, end, new Date(b.startISO), new Date(b.endISO)));
      const hasConflict = bookingConflict || calendarConflict;
      if (!hasConflict) slots.push(start.toISOString());
    }
    dayYmd = addDaysYmd(dayYmd, 1);
  }

  return slots.slice(0, 20);
}

export async function createBookingRecord(params: {
  business: BusinessConfig;
  serviceName: string;
  startTimeISO: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  status: 'confirmed' | 'requested';
  notes?: string;
}) {
  const store = getStore();
  const blockReason = await getBookingBlockReason(params.business.businessId);
  if (blockReason) throw new Error(blockReason);
  const service = findService(params.business, params.serviceName);
  const start = new Date(params.startTimeISO);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + service.durationMin + (service.bufferMin ?? 0));

  if (params.status === 'confirmed') {
    const calendarConn = await store.getGoogleCalendarConnection(params.business.businessId);
    if (!calendarConn) {
      throw new Error('Online booking is unavailable right now. Please call the business to book by phone.');
    }

    const existing = await store.listBookings(params.business.businessId);
    const conflict = existing.some((b) => overlaps(start, end, new Date(b.startTimeISO), new Date(b.endTimeISO)));
    if (conflict) {
      throw new Error('Selected time is no longer available.');
    }

    const busyInCalendar = await getCalendarBusyRanges(
      params.business,
      new Date(start.getTime() - 60 * 1000).toISOString(),
      new Date(end.getTime() + 60 * 1000).toISOString()
    );
    const calendarConflict = busyInCalendar.some((b) =>
      overlaps(start, end, new Date(b.startISO), new Date(b.endISO))
    );
    if (calendarConflict) {
      throw new Error('Selected time is no longer available.');
    }
  }

  const booking = await store.createBooking({
    businessId: params.business.businessId,
    serviceName: params.serviceName,
    startTimeISO: start.toISOString(),
    endTimeISO: end.toISOString(),
    customerName: params.customerName,
    customerPhone: params.customerPhone || params.customerEmail || '',
    customerEmail: params.customerEmail,
    status: params.status,
    notes: params.notes
  });

  if (params.status === 'confirmed') {
    try {
      const calendarResult = await createCalendarEvent(booking, params.business);
      if (!calendarResult?.eventId) {
        await store.deleteBooking(booking.bookingId).catch(() => null);
        throw new Error('Calendar event was not created. Please try again.');
      }
      await store.updateBookingCalendarEvent(booking.bookingId, calendarResult.eventId).catch(() => null);
      console.log('Calendar event created:', calendarResult.htmlLink);
    } catch (error) {
      await store.deleteBooking(booking.bookingId).catch(() => null);
      console.error('Failed to create calendar event:', error);
      await sendAlertEmail({
        severity: 'error',
        title: 'Calendar event creation failed',
        message: error instanceof Error ? error.message : 'Unknown calendar error',
        context: { businessId: params.business.businessId, bookingId: booking.bookingId, serviceName: params.serviceName }
      });
      throw new Error('Unable to confirm booking in calendar. Please try again or call the business.');
    }
  }

  return booking;
}
