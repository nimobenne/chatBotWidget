import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { BookingRecord, BusinessConfig, ConversationLog, HandoffRecord } from './types';

const DATA_DIR = process.cwd() + '/data';
const BUSINESSES_PATH = DATA_DIR + '/businesses.json';
const BOOKINGS_PATH = DATA_DIR + '/bookings.json';
const HANDOFFS_PATH = DATA_DIR + '/handoffs.json';
const CONVERSATIONS_PATH = DATA_DIR + '/conversations.json';

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
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch {
    // Fail silently on read-only filesystems
  }
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

class SupabaseDataStore implements DataStore {
  private client;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  async listBusinesses(): Promise<BusinessConfig[]> {
    const { data, error } = await this.client.from('businesses').select('*');
    if (error) throw new Error(error.message);
    return (data as BusinessConfig[]) || [];
  }

  async getBusinessConfig(businessId: string): Promise<BusinessConfig | null> {
    const { data, error } = await this.client
      .from('businesses')
      .select('*')
      .eq('businessId', businessId)
      .single();
    if (error) return null;
    return data as BusinessConfig;
  }

  async saveBusinessConfig(business: BusinessConfig): Promise<void> {
    const { error } = await this.client
      .from('businesses')
      .upsert({ ...business }, { onConflict: 'businessId' });
    if (error) throw new Error(error.message);
  }

  async listBookings(businessId: string): Promise<BookingRecord[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('businessId', businessId);
    if (error) throw new Error(error.message);
    return (data as BookingRecord[]) || [];
  }

  async createBooking(record: Omit<BookingRecord, 'bookingId' | 'createdAt'>): Promise<BookingRecord> {
    const booking: BookingRecord = {
      ...record,
      bookingId: randomUUID(),
      createdAt: new Date().toISOString()
    };
    const { error } = await this.client.from('bookings').insert(booking);
    if (error) throw new Error(error.message);
    return booking;
  }

  async createHandoff(record: Omit<HandoffRecord, 'handoffId' | 'createdAt'>): Promise<HandoffRecord> {
    const handoff: HandoffRecord = {
      ...record,
      handoffId: randomUUID(),
      createdAt: new Date().toISOString()
    };
    const { error } = await this.client.from('handoffs').insert(handoff);
    if (error) throw new Error(error.message);
    return handoff;
  }

  async logConversation(log: ConversationLog): Promise<void> {
    const { error } = await this.client.from('conversations').insert(log);
    if (error) console.error('Failed to log conversation:', error.message);
  }
}

let singleton: DataStore | null = null;

export function getStore(): DataStore {
  const dataStoreType = process.env.DATA_STORE || 'json';
  
  if (dataStoreType === 'supabase') {
    try {
      if (!singleton || !(singleton instanceof SupabaseDataStore)) {
        singleton = new SupabaseDataStore();
      }
      return singleton;
    } catch (err) {
      console.warn('Supabase store failed to initialize, falling back to JSON:', err);
    }
  }
  
  if (dataStoreType === 'postgres') {
    try {
      if (!singleton || !(singleton instanceof SupabaseDataStore)) {
        singleton = new SupabaseDataStore();
      }
      return singleton;
    } catch (err) {
      console.warn('Supabase store failed to initialize, falling back to JSON:', err);
    }
  }
  
  if (!singleton || !(singleton instanceof JsonDataStore)) {
    singleton = new JsonDataStore();
  }
  return singleton;
}
