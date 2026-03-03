import { getStore } from './store';
import { BookingRecord, BusinessConfig, Service } from './types';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const SLOT_STEP_MINUTES = 30;

type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: (typeof DAY_NAMES)[number] };

function getTimeZoneParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long'
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
    weekday: String(byType.weekday).toLowerCase() as (typeof DAY_NAMES)[number]
  };
}

function zonedDateTimeToUtc(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  for (let i = 0; i < 3; i += 1) {
    const observed = getTimeZoneParts(candidate, timeZone);
    const desiredEpoch = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const observedEpoch = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second, 0);
    const deltaMs = desiredEpoch - observedEpoch;
    if (deltaMs === 0) break;
    candidate = new Date(candidate.getTime() + deltaMs);
  }
  return candidate;
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

function compareYmd(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export async function getAvailableSlots(business: BusinessConfig, serviceName: string, dateRangeISO: { start: string; end: string }): Promise<string[]> {
  const store = getStore();
  const service = findService(business, serviceName);
  const existing = await store.listBookings(business.businessId);
  const rangeStart = new Date(dateRangeISO.start);
  const rangeEnd = new Date(dateRangeISO.end);
  const slots: string[] = [];

  const startLocal = getTimeZoneParts(rangeStart, business.timezone);
  const endLocal = getTimeZoneParts(rangeEnd, business.timezone);
  let current = { year: startLocal.year, month: startLocal.month, day: startLocal.day };

  while (compareYmd(current, endLocal) <= 0) {
    const dayAnchor = zonedDateTimeToUtc(business.timezone, current.year, current.month, current.day, 0, 0);
    const weekday = getTimeZoneParts(dayAnchor, business.timezone).weekday;
    const rule = business.hours[weekday];

    if (rule) {
      const [openHour, openMinute] = rule.open.split(':').map(Number);
      const [closeHour, closeMinute] = rule.close.split(':').map(Number);
      const open = zonedDateTimeToUtc(business.timezone, current.year, current.month, current.day, openHour, openMinute);
      const close = zonedDateTimeToUtc(business.timezone, current.year, current.month, current.day, closeHour, closeMinute);

      for (let cursorMs = open.getTime(); cursorMs < close.getTime(); cursorMs += SLOT_STEP_MINUTES * 60 * 1000) {
        const start = new Date(cursorMs);
        const end = new Date(start.getTime() + (service.durationMin + (service.bufferMin ?? 0)) * 60 * 1000);
        if (end > close || start < rangeStart || start > rangeEnd) continue;
        const hasConflict = existing.some((b: BookingRecord) => overlaps(start, end, new Date(b.startTimeISO), new Date(b.endTimeISO)));
        if (!hasConflict) slots.push(start.toISOString());
      }
    }

    const next = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    current = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
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
