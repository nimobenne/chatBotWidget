import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BookingRecord, BusinessConfig, ConversationLog, HandoffRecord } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUSINESSES_PATH = path.join(DATA_DIR, 'businesses.json');
const BOOKINGS_PATH = path.join(DATA_DIR, 'bookings.json');
const HANDOFFS_PATH = path.join(DATA_DIR, 'handoffs.json');
const CONVERSATIONS_PATH = path.join(DATA_DIR, 'conversations.json');

export interface DataStore {
  listBusinesses(): Promise<BusinessConfig[]>;
  getBusinessConfig(businessId: string): Promise<BusinessConfig | null>;
  saveBusinessConfig(business: BusinessConfig): Promise<void>;
  listBookings(businessId: string): Promise<BookingRecord[]>;
  createBooking(record: Omit<BookingRecord, 'bookingId' | 'createdAt'>): Promise<BookingRecord>;
  createHandoff(record: Omit<HandoffRecord, 'handoffId' | 'createdAt'>): Promise<HandoffRecord>;
  logConversation(log: ConversationLog): Promise<void>;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

class JsonDataStore implements DataStore {
  async listBusinesses(): Promise<BusinessConfig[]> {
    return readJson<BusinessConfig[]>(BUSINESSES_PATH, []);
  }

  async getBusinessConfig(businessId: string): Promise<BusinessConfig | null> {
    const businesses = await this.listBusinesses();
    return businesses.find((biz) => biz.businessId === businessId) ?? null;
  }

  async saveBusinessConfig(business: BusinessConfig): Promise<void> {
    const businesses = await this.listBusinesses();
    const idx = businesses.findIndex((b) => b.businessId === business.businessId);
    if (idx >= 0) {
      businesses[idx] = business;
    } else {
      businesses.push(business);
    }
    await writeJson(BUSINESSES_PATH, businesses);
  }

  async listBookings(businessId: string): Promise<BookingRecord[]> {
    const bookings = await readJson<BookingRecord[]>(BOOKINGS_PATH, []);
    return bookings.filter((b) => b.businessId === businessId);
  }

  async createBooking(record: Omit<BookingRecord, 'bookingId' | 'createdAt'>): Promise<BookingRecord> {
    const bookings = await readJson<BookingRecord[]>(BOOKINGS_PATH, []);
    const booking: BookingRecord = { ...record, bookingId: randomUUID(), createdAt: new Date().toISOString() };
    bookings.push(booking);
    await writeJson(BOOKINGS_PATH, bookings);
    return booking;
  }

  async createHandoff(record: Omit<HandoffRecord, 'handoffId' | 'createdAt'>): Promise<HandoffRecord> {
    const handoffs = await readJson<HandoffRecord[]>(HANDOFFS_PATH, []);
    const handoff: HandoffRecord = { ...record, handoffId: randomUUID(), createdAt: new Date().toISOString() };
    handoffs.push(handoff);
    await writeJson(HANDOFFS_PATH, handoffs);
    return handoff;
  }

  async logConversation(log: ConversationLog): Promise<void> {
    const logs = await readJson<ConversationLog[]>(CONVERSATIONS_PATH, []);
    logs.push(log);
    await writeJson(CONVERSATIONS_PATH, logs);
  }
}

let singleton: DataStore | null = null;

export function getStore(): DataStore {
  if (process.env.DATA_STORE === 'postgres') {
    throw new Error('Postgres store not yet wired. Implement DataStore with your DB client and set DATA_STORE=postgres.');
  }
  if (!singleton) singleton = new JsonDataStore();
  return singleton;
}
