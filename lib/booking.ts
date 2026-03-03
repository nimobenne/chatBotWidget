import { getStore } from './store';
import { BookingRecord, BusinessConfig, Service } from './types';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getZonedParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
    second: Number(pick('second')),
    weekday: (pick('weekday') || '').toLowerCase()
  };
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function addDays(dateKey: string, deltaDays: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return toDateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = getZonedParts(date, timezone);
  return toDateKey(parts.year, parts.month, parts.day);
}

function zonedDateTimeToUtc(dateKey: string, hhmm: string, timezone: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const [hour, minute] = hhmm.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;

  for (let i = 0; i < 4; i += 1) {
    const observed = getZonedParts(new Date(guess), timezone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const delta = target - observedAsUtc;
    guess += delta;
    if (delta === 0) break;
  }

  return new Date(guess);
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
  const rangeStart = new Date(dateRangeISO.start);
  const rangeEnd = new Date(dateRangeISO.end);
  const slots: string[] = [];

  const startKey = dateKeyInTimezone(rangeStart, business.timezone);
  const endKey = dateKeyInTimezone(rangeEnd, business.timezone);

  for (let dayKey = startKey; dayKey <= endKey; dayKey = addDays(dayKey, 1)) {
    const weekday = getZonedParts(zonedDateTimeToUtc(dayKey, '12:00', business.timezone), business.timezone).weekday;
    const dayName = DAY_NAMES.find((name) => name === weekday);
    if (!dayName) continue;

    const rule = business.hours[dayName];
    if (!rule) continue;

    const open = zonedDateTimeToUtc(dayKey, rule.open, business.timezone);
    const close = zonedDateTimeToUtc(dayKey, rule.close, business.timezone);
    if (close <= open) continue;

    const step = 30;
    for (let cursor = new Date(open); cursor < close; cursor.setMinutes(cursor.getMinutes() + step)) {
      const start = new Date(cursor);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + service.durationMin + (service.bufferMin ?? 0));
      if (end > close || start < rangeStart || start > rangeEnd) continue;
      const hasConflict = existing.some((b: BookingRecord) => overlaps(start, end, new Date(b.startTimeISO), new Date(b.endTimeISO)));
      if (!hasConflict) slots.push(start.toISOString());
    }
  }

  return slots.slice(0, 20);
}

export async function createBookingRecord(params: {
  business: BusinessConfig;
  serviceName: string;
  startTimeISO: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  status: 'confirmed' | 'requested';
  notes?: string;
}) {
  const store = getStore();
  const service = findService(params.business, params.serviceName);
  const start = new Date(params.startTimeISO);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + service.durationMin + (service.bufferMin ?? 0));

  if (params.status === 'confirmed') {
    const existing = await store.listBookings(params.business.businessId);
    const conflict = existing.some((b) => overlaps(start, end, new Date(b.startTimeISO), new Date(b.endTimeISO)));
    if (conflict) {
      throw new Error('Selected time is no longer available.');
    }
  }

  return store.createBooking({
    businessId: params.business.businessId,
    serviceName: params.serviceName,
    startTimeISO: start.toISOString(),
    endTimeISO: end.toISOString(),
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
    status: params.status,
    notes: params.notes
  });
}
