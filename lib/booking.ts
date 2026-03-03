import { fetchGoogleBusyRanges } from './google';
import { BusinessRow, getSupabaseStore } from './store.supabase';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseClock(date: Date, hhmm: string): Date {
  const [hours, mins] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hours, mins, 0, 0);
  return d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function findService(business: BusinessRow, serviceName: string) {
  const service = business.services.find((s) => s.name.toLowerCase() === serviceName.toLowerCase());
  if (!service) throw new Error(`Unknown service: ${serviceName}`);
  return service;
}

function normalizeRange(dateRangeISO: { start: string; end: string }, bookingWindowDays = 14): { start: Date; end: Date } {
  let start = new Date(dateRangeISO.start);
  let end = new Date(dateRangeISO.end);

  const invalid = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start;
  if (invalid) {
    start = new Date();
    end = new Date(start);
    end.setDate(end.getDate() + bookingWindowDays);
  }

  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    end.getMilliseconds() === 0
  ) {
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export async function getAvailableSlots(
  business: BusinessRow,
  serviceName: string,
  dateRangeISO: { start: string; end: string }
): Promise<string[]> {
  const store = getSupabaseStore();
  const service = findService(business, serviceName);
  const normalizedRange = normalizeRange(dateRangeISO);
  const rangeStart = normalizedRange.start;
  const rangeEnd = normalizedRange.end;

  const existing = await store.getBookingsInRange(business.id, rangeStart.toISOString(), rangeEnd.toISOString());
  let googleBusy: Array<{ start: string; end: string }> = [];
  try {
    googleBusy = await fetchGoogleBusyRanges({
      businessId: business.id,
      startISO: rangeStart.toISOString(),
      endISO: rangeEnd.toISOString()
    });
  } catch {
    // If Google is not connected or freebusy fails, fallback to internal bookings only.
  }

  const slots: string[] = [];

  for (let day = new Date(rangeStart); day <= rangeEnd; day.setDate(day.getDate() + 1)) {
    const rule = business.hours?.[DAY_NAMES[day.getDay()]];
    if (!rule) continue;

    const open = parseClock(day, rule.open);
    const close = parseClock(day, rule.close);
    const step = business.slot_interval_min ?? 30;

    for (let cursor = new Date(open); cursor < close; cursor.setMinutes(cursor.getMinutes() + step)) {
      const start = new Date(cursor);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + service.duration_min + (service.buffer_min ?? 0));

      if (end > close || start < rangeStart || start > rangeEnd) continue;
      const hasLocalConflict = existing.some((b) => overlaps(start, end, new Date(b.start_time), new Date(b.end_time)));
      const hasGoogleConflict = googleBusy.some((busy) => overlaps(start, end, new Date(busy.start), new Date(busy.end)));
      if (!hasLocalConflict && !hasGoogleConflict) slots.push(start.toISOString());
    }
  }

  return Array.from(new Set(slots)).slice(0, 8);
}

export async function createBookingRecord(params: {
  business: BusinessRow;
  serviceName: string;
  startTimeISO: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  status: 'confirmed' | 'requested';
  notes?: string;
  calendarEventId?: string;
}) {
  const store = getSupabaseStore();
  const service = findService(params.business, params.serviceName);
  const start = new Date(params.startTimeISO);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + service.duration_min + (service.buffer_min ?? 0));

  return store.createBooking({
    business_id: params.business.id,
    service: params.serviceName,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    customer_name: params.customerName,
    phone: params.customerPhone,
    email: params.customerEmail,
    status: params.status,
    notes: params.notes,
    calendar_event_id: params.calendarEventId
  });
}
