import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { BookingRecord, BusinessConfig, ConversationLog, HandoffRecord } from './types';
import { normalizeStoreMode } from './config';

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
  deleteBooking(bookingId: string): Promise<void>;
  updateBookingCalendarEvent(bookingId: string, eventId: string): Promise<void>;
  createHandoff(record: Omit<HandoffRecord, 'handoffId' | 'createdAt'>): Promise<HandoffRecord>;
  logConversation(log: ConversationLog): Promise<void>;
  getConversationHistory(businessId: string, sessionId: string, limit?: number): Promise<ConversationLog[]>;
  deleteConversationHistory(businessId: string, sessionId: string): Promise<void>;
  getGoogleCalendarConnection(businessId: string): Promise<GoogleCalendarConnection | null>;
  saveGoogleCalendarConnection(conn: Omit<GoogleCalendarConnection, 'createdAt' | 'updatedAt'>): Promise<void>;
  removeGoogleCalendarConnection(businessId: string): Promise<void>;
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

  async updateBookingCalendarEvent(_bookingId: string, _eventId: string): Promise<void> {
    // JSON fallback store does not persist calendar event ids separately.
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const bookings = await readJson<BookingRecord[]>(BOOKINGS_PATH, []);
    const filtered = bookings.filter((b) => b.bookingId !== bookingId);
    await writeJson(BOOKINGS_PATH, filtered);
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

  async getConversationHistory(businessId: string, sessionId: string, limit = 10): Promise<ConversationLog[]> {
    const logs = await readJson<ConversationLog[]>(CONVERSATIONS_PATH, []);
    return logs
      .filter(l => l.businessId === businessId && l.sessionId === sessionId)
      .slice(-limit);
  }

  async deleteConversationHistory(businessId: string, sessionId: string): Promise<void> {
    const logs = await readJson<ConversationLog[]>(CONVERSATIONS_PATH, []);
    const filtered = logs.filter((l) => !(l.businessId === businessId && l.sessionId === sessionId));
    await writeJson(CONVERSATIONS_PATH, filtered);
  }

  async getGoogleCalendarConnection(_businessId: string): Promise<GoogleCalendarConnection | null> {
    return null;
  }

  async saveGoogleCalendarConnection(_conn: Omit<GoogleCalendarConnection, 'createdAt' | 'updatedAt'>): Promise<void> {
    // Not implemented for JSON store
  }

  async removeGoogleCalendarConnection(_businessId: string): Promise<void> {
    // Not implemented for JSON store
  }
}

interface SupabaseBusiness {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  phone: string;
  email: string;
  address: string;
  hours: Record<string, { open: string; close: string } | null>;
  services: { name: string; durationMin: number; priceRange?: string; bufferMin?: number }[];
  allowed_domains: string[];
  booking_mode: string;
  faqs: Record<string, string>;
  policies: { cancellation: string; booking: string };
  slot_interval_min: number;
  buffer_min: number;
  booking_window_days: number;
  widget_style: { accentColor?: string };
  created_at: string;
  updated_at: string;
}

interface SupabaseBooking {
  id: string;
  business_id: string;
  service: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  notes: string;
  calendar_event_id: string;
  created_at: string;
}

interface SupabaseConversationRow {
  session_id: string;
  last_user_message: string;
  last_assistant_message: string;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarConnection {
  businessId: string;
  calendarId: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

function toBusinessConfig(sb: SupabaseBusiness): BusinessConfig {
  return {
    businessId: sb.slug,
    name: sb.name,
    timezone: sb.timezone,
    hours: sb.hours,
    services: sb.services,
    policies: sb.policies,
    contact: { phone: sb.phone, email: sb.email, address: sb.address },
    faq: sb.faqs,
    allowedDomains: sb.allowed_domains,
    bookingMode: sb.booking_mode as 'request' | 'calendar',
    styling: sb.widget_style
  };
}

// Module-level cache shared across calls within the same serverless instance.
// Prevents N+1 config queries on every chat turn. TTL keeps config fresh after owner edits.
const BUSINESS_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
const businessConfigCache = new Map<string, { config: BusinessConfig; expiresAt: number }>();

class SupabaseDataStore implements DataStore {
  private client;
  private businessIdCache: Map<string, string> = new Map();

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  private async getBusinessDbId(slug: string): Promise<string | null> {
    if (this.businessIdCache.has(slug)) {
      return this.businessIdCache.get(slug)!;
    }
    const { data, error } = await this.client
      .from('businesses')
      .select('id')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;
    this.businessIdCache.set(slug, data.id);
    return data.id;
  }

  async listBusinesses(): Promise<BusinessConfig[]> {
    const { data, error } = await this.client.from('businesses').select('*');
    if (error) throw new Error(error.message);
    return (data as SupabaseBusiness[]).map(toBusinessConfig);
  }

  async getBusinessConfig(businessId: string): Promise<BusinessConfig | null> {
    const cached = businessConfigCache.get(businessId);
    if (cached && Date.now() < cached.expiresAt) return cached.config;

    const { data, error } = await this.client
      .from('businesses')
      .select('*')
      .eq('slug', businessId)
      .single();
    if (error) return null;
    const config = toBusinessConfig(data as SupabaseBusiness);
    businessConfigCache.set(businessId, { config, expiresAt: Date.now() + BUSINESS_CONFIG_TTL_MS });
    return config;
  }

  async saveBusinessConfig(business: BusinessConfig): Promise<void> {
    const sbRecord = {
      slug: business.businessId,
      name: business.name,
      timezone: business.timezone,
      hours: business.hours,
      services: business.services,
      policies: business.policies,
      phone: business.contact.phone,
      email: business.contact.email,
      address: business.contact.address,
      faqs: business.faq,
      allowed_domains: business.allowedDomains,
      booking_mode: business.bookingMode,
      slot_interval_min: 30,
      buffer_min: 10,
      booking_window_days: 30,
      widget_style: business.styling
    };
    const { error } = await this.client
      .from('businesses')
      .upsert(sbRecord, { onConflict: 'slug' });
    if (error) throw new Error(error.message);
  }

  async listBookings(businessId: string): Promise<BookingRecord[]> {
    const businessDbId = await this.getBusinessDbId(businessId);
    if (!businessDbId) return [];
    
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('business_id', businessDbId)
      .gte('start_time', new Date().toISOString())
      .neq('status', 'cancelled');
    if (error) throw new Error(error.message);

    return (data as SupabaseBooking[]).map((b) => ({
      bookingId: b.id,
      businessId: businessId,
      serviceName: b.service,
      startTimeISO: b.start_time,
      endTimeISO: b.end_time,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      customerEmail: b.customer_email,
      status: b.status as 'confirmed' | 'requested' | 'cancelled',
      notes: b.notes,
      createdAt: b.created_at
    }));
  }

  async createBooking(record: Omit<BookingRecord, 'bookingId' | 'createdAt'>): Promise<BookingRecord> {
    const businessDbId = await this.getBusinessDbId(record.businessId);
    if (!businessDbId) throw new Error('Business not found');
    
    const bookingDbId = randomUUID();
    const now = new Date().toISOString();
    const { error } = await this.client.from('bookings').insert({
      id: bookingDbId,
      business_id: businessDbId,
      service: record.serviceName,
      start_time: record.startTimeISO,
      end_time: record.endTimeISO,
      customer_name: record.customerName,
      customer_phone: record.customerPhone,
      customer_email: record.customerEmail,
      status: record.status,
      notes: record.notes,
      created_at: now
    });
    if (error) throw new Error(error.message);
    
    return {
      ...record,
      bookingId: bookingDbId,
      createdAt: now
    };
  }

  async updateBookingCalendarEvent(bookingId: string, eventId: string): Promise<void> {
    const { error } = await this.client
      .from('bookings')
      .update({ calendar_event_id: eventId })
      .eq('id', bookingId);
    if (error) throw new Error(error.message);
  }

  async deleteBooking(bookingId: string): Promise<void> {
    const { error } = await this.client
      .from('bookings')
      .delete()
      .eq('id', bookingId);
    if (error) throw new Error(error.message);
  }

  async createHandoff(record: Omit<HandoffRecord, 'handoffId' | 'createdAt'>): Promise<HandoffRecord> {
    const businessDbId = await this.getBusinessDbId(record.businessId);
    if (!businessDbId) throw new Error('Business not found');
    
    const handoffDbId = randomUUID();
    const now = new Date().toISOString();
    const { error } = await this.client.from('handoffs').insert({
      id: handoffDbId,
      business_id: businessDbId,
      summary: record.summary,
      customer_contact: { phone: record.customerContact, email: '' },
      status: 'open',
      channel: 'chat',
      last_user_message: record.customerContact,
      created_at: now
    });
    if (error) throw new Error(error.message);
    
    return {
      ...record,
      handoffId: handoffDbId,
      createdAt: now
    };
  }

  async logConversation(log: ConversationLog): Promise<void> {
    const businessDbId = await this.getBusinessDbId(log.businessId);
    if (!businessDbId) return;
    
    const now = new Date().toISOString();
    const { error } = await this.client.from('conversations').insert({
      business_id: businessDbId,
      session_id: log.sessionId,
      last_user_message: log.userMessage,
      last_assistant_message: log.assistantMessage,
      created_at: now,
      updated_at: now
    });
    
    if (error) console.error('Failed to log conversation:', error.message);
  }

  async getConversationHistory(businessId: string, sessionId: string, limit = 10): Promise<ConversationLog[]> {
    const businessDbId = await this.getBusinessDbId(businessId);
    if (!businessDbId) return [];
    
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('business_id', businessDbId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error || !data) return [];
    
    return (data as SupabaseConversationRow[]).map((c) => ({
      businessId,
      sessionId: c.session_id,
      userMessage: c.last_user_message,
      assistantMessage: c.last_assistant_message,
      createdAt: c.created_at || c.updated_at || new Date().toISOString()
    }));
  }

  async deleteConversationHistory(businessId: string, sessionId: string): Promise<void> {
    const businessDbId = await this.getBusinessDbId(businessId);
    if (!businessDbId) return;
    const { error } = await this.client
      .from('conversations')
      .delete()
      .eq('business_id', businessDbId)
      .eq('session_id', sessionId);
    if (error) throw new Error(error.message);
  }

  async getGoogleCalendarConnection(businessId: string): Promise<GoogleCalendarConnection | null> {
    const businessDbId = await this.getBusinessDbId(businessId);
    if (!businessDbId) return null;
    
    const { data, error } = await this.client
      .from('google_calendar_connections')
      .select('*')
      .eq('business_id', businessDbId)
      .single();
    
    if (error || !data) return null;
    
    return {
      businessId: businessId,
      calendarId: data.calendar_id,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async saveGoogleCalendarConnection(conn: Omit<GoogleCalendarConnection, 'createdAt' | 'updatedAt'>): Promise<void> {
    const businessDbId = await this.getBusinessDbId(conn.businessId);
    if (!businessDbId) throw new Error('Business not found');
    
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('google_calendar_connections')
      .upsert({
        business_id: businessDbId,
        calendar_id: conn.calendarId,
        refresh_token: conn.refreshToken,
        token_type: conn.tokenType,
        scope: conn.scope,
        updated_at: now
      }, { onConflict: 'business_id' });
    
    if (error) throw new Error(error.message);
  }

  async removeGoogleCalendarConnection(businessId: string): Promise<void> {
    const businessDbId = await this.getBusinessDbId(businessId);
    if (!businessDbId) return;
    const { error } = await this.client
      .from('google_calendar_connections')
      .delete()
      .eq('business_id', businessDbId);
    if (error) throw new Error(error.message);
  }
}

let singleton: DataStore | null = null;

export function getStore(): DataStore {
  const rawStoreType = process.env.DATA_STORE || 'json';
  const dataStoreType = normalizeStoreMode(rawStoreType);
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  if (dataStoreType === 'unsupported') {
    const msg = `Unsupported DATA_STORE value: ${rawStoreType}`;
    if (isProd) throw new Error(msg);
    console.warn(msg);
  }
  
  if (dataStoreType === 'supabase') {
    try {
      if (!singleton || !(singleton instanceof SupabaseDataStore)) {
        singleton = new SupabaseDataStore();
      }
      return singleton;
    } catch (err) {
      if (isProd) {
        throw new Error(`Supabase store failed to initialize in production: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      console.warn('Supabase store failed to initialize, falling back to JSON:', err);
    }
  }
  
  if (dataStoreType === 'postgres') {
    // postgres and supabase are the same store implementation
    try {
      if (!singleton || !(singleton instanceof SupabaseDataStore)) {
        singleton = new SupabaseDataStore();
      }
      return singleton;
    } catch (err) {
      if (isProd) {
        throw new Error(`Postgres/Supabase store failed to initialize in production: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      console.warn('Supabase store failed to initialize, falling back to JSON:', err);
    }
  }
  
  if (!singleton || !(singleton instanceof JsonDataStore)) {
    singleton = new JsonDataStore();
  }
  return singleton;
}
