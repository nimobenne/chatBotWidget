import { getStore } from './store';
import { BookingRecord, BusinessConfig, Service } from './types';
import { createCalendarEvent } from './calendar';

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

  for (let day = new Date(rangeStart); day <= rangeEnd; day.setDate(day.getDate() + 1)) {
    const rule = business.hours[DAY_NAMES[day.getDay()]];
    if (!rule) continue;
    const open = parseClock(day, rule.open);
    const close = parseClock(day, rule.close);
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

  const booking = await store.createBooking({
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

  if (params.status === 'confirmed') {
    try {
      const calendarResult = await createCalendarEvent(booking, params.business);
      if (calendarResult) {
        console.log('Calendar event created:', calendarResult.htmlLink);
      }
    } catch (error) {
      console.error('Failed to create calendar event:', error);
    }
  }

  return booking;
}
