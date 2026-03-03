import { getSupabaseAdmin } from './supabase';

export interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  hours: Record<string, { open: string; close: string } | null>;
  services: Array<{ name: string; duration_min: number; price_range?: string; buffer_min?: number }>;
  policies: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  faq: Record<string, string> | null;
  allowed_domains: string[];
  booking_mode: 'request' | 'calendar';
  slot_interval_min: number | null;
  accent_color: string | null;
}

export interface BookingRow {
  id: string;
  business_id: string;
  service: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: 'confirmed' | 'requested' | 'cancelled';
  calendar_event_id: string | null;
  notes: string | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string; at: string }> | null;
}

interface RawBusinessRow {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  hours: Record<string, { open: string; close: string } | null>;
  services: unknown;
  policies: Record<string, string> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  faqs: unknown;
  allowed_domains: string[];
  booking_mode: 'request' | 'calendar';
  slot_interval_min: number | null;
  widget_style: Record<string, unknown> | null;
  buffer_min: number | null;
}

export interface Store {
  getBusinessBySlug(slug: string): Promise<BusinessRow | null>;
  listBusinesses(): Promise<BusinessRow[]>;
  getConversationMessages(business_id: string, session_id: string): Promise<Array<{ role: 'user' | 'assistant'; content: string; at: string }>>;
  upsertConversation(input: {
    business_id: string;
    session_id: string;
    newMessages: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
    last_user: string;
    last_assistant: string;
  }): Promise<void>;
  createBooking(input: {
    business_id: string;
    service: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    phone: string;
    email?: string;
    status: 'confirmed' | 'requested';
    calendar_event_id?: string;
    notes?: string;
  }): Promise<BookingRow>;
  createHandoff(input: {
    business_id: string;
    summary: string;
    last_user_message: string;
    customer_contact: string;
    channel: string;
  }): Promise<void>;
  getBookingsInRange(business_id: string, start: string, end: string): Promise<BookingRow[]>;
  getGoogleConnection(business_id: string): Promise<{ refresh_token: string; calendar_id: string | null } | null>;
  upsertGoogleConnection(input: { business_id: string; refresh_token: string; calendar_id?: string | null }): Promise<void>;
}

function normalizeFaq(input: unknown): Record<string, string> | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    input.forEach((entry, idx) => {
      if (typeof entry === 'string') out[`faq_${idx + 1}`] = entry;
      else if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const key = typeof obj.question === 'string' ? obj.question : `faq_${idx + 1}`;
        const value = typeof obj.answer === 'string' ? obj.answer : JSON.stringify(obj);
        out[key] = value;
      }
    });
    return out;
  }
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, v as string])
    );
  }
  return null;
}


function normalizeHours(input: unknown): Record<string, { open: string; close: string } | null> {
  const normalized: Record<string, { open: string; close: string } | null> = {};
  if (!input || typeof input !== 'object') {
    return {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '10:00', close: '15:00' },
      sunday: null
    };
  }

  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const key = k.toLowerCase();
    if (v === null) {
      normalized[key] = null;
      continue;
    }
    if (v && typeof v === 'object') {
      const raw = v as Record<string, unknown>;
      if (typeof raw.open === 'string' && typeof raw.close === 'string') {
        normalized[key] = { open: raw.open, close: raw.close };
      }
    }
  }

  return Object.keys(normalized).length ? normalized : {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: { open: '10:00', close: '15:00' },
    sunday: null
  };
}

function normalizeServices(input: unknown, defaultBufferMin: number | null): Array<{ name: string; duration_min: number; price_range?: string; buffer_min?: number }> {
  if (!Array.isArray(input)) return [];

  const normalized: Array<{ name: string; duration_min: number; price_range?: string; buffer_min?: number }> = [];
  for (const svc of input) {
    if (!svc || typeof svc !== 'object') continue;
    const raw = svc as Record<string, unknown>;
    if (typeof raw.name !== 'string') continue;

    const duration = typeof raw.duration_min === 'number'
      ? raw.duration_min
      : typeof raw.durationMin === 'number'
        ? raw.durationMin
        : 30;
    const buffer = typeof raw.buffer_min === 'number'
      ? raw.buffer_min
      : typeof raw.bufferMin === 'number'
        ? raw.bufferMin
        : defaultBufferMin ?? undefined;
    const price = typeof raw.price_range === 'string'
      ? raw.price_range
      : typeof raw.priceRange === 'string'
        ? raw.priceRange
        : undefined;

    normalized.push({ name: raw.name, duration_min: duration, buffer_min: buffer, price_range: price });
  }

  return normalized;
}

function normalizeBusiness(row: RawBusinessRow): BusinessRow {
  const widgetStyle = row.widget_style && typeof row.widget_style === 'object' ? row.widget_style : {};
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    hours: normalizeHours(row.hours),
    services: normalizeServices(row.services, row.buffer_min),
    policies: row.policies || null,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    address: row.address,
    faq: normalizeFaq(row.faqs),
    allowed_domains: row.allowed_domains || [],
    booking_mode: row.booking_mode,
    slot_interval_min: row.slot_interval_min,
    accent_color: typeof widgetStyle.accentColor === 'string' ? widgetStyle.accentColor : null
  };
}

class SupabaseStore implements Store {
  async getBusinessBySlug(slug: string): Promise<BusinessRow | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('businesses')
      .select('id, slug, name, timezone, hours, services, policies, contact_phone:phone, contact_email:email, address, faqs, allowed_domains, booking_mode, slot_interval_min, widget_style, buffer_min')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw new Error(`Failed to load business: ${error.message}`);
    if (!data) return null;

    return normalizeBusiness(data as unknown as RawBusinessRow);
  }

  async listBusinesses(): Promise<BusinessRow[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('businesses')
      .select('id, slug, name, timezone, hours, services, policies, phone, email, address, faqs, allowed_domains, booking_mode, slot_interval_min, widget_style, buffer_min')
      .order('slug');

    if (error) throw new Error(`Failed to list businesses: ${error.message}`);

    return (data || []).map((item: unknown) => {
      const row = item as Record<string, unknown>;
      return normalizeBusiness({
        ...(row as unknown as RawBusinessRow),
        contact_phone: (row.phone as string | null) ?? null,
        contact_email: (row.email as string | null) ?? null
      });
    });
  }

  async getConversationMessages(business_id: string, session_id: string): Promise<Array<{ role: 'user' | 'assistant'; content: string; at: string }>> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('business_id', business_id)
      .eq('session_id', session_id)
      .maybeSingle();

    if (error && !error.message.toLowerCase().includes('no rows')) {
      throw new Error(`Failed to load conversation: ${error.message}`);
    }

    const messages = (data as { messages?: Array<{ role: 'user' | 'assistant'; content: string; at: string }> } | null)?.messages;
    return Array.isArray(messages) ? messages : [];
  }

  async upsertConversation(input: {
    business_id: string;
    session_id: string;
    newMessages: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
    last_user: string;
    last_assistant: string;
  }): Promise<void> {
    const supabase = getSupabaseAdmin();

    const existing = await supabase
      .from('conversations')
      .select('id, messages')
      .eq('business_id', input.business_id)
      .eq('session_id', input.session_id)
      .maybeSingle();

    if (existing.error && !existing.error.message.toLowerCase().includes('no rows')) {
      throw new Error(`Failed to load conversation: ${existing.error.message}`);
    }

    const current = (existing.data as ConversationRow | null)?.messages || [];
    const messages = [...current.slice(-100), ...input.newMessages];

    if ((existing.data as ConversationRow | null)?.id) {
      const { error } = await supabase
        .from('conversations')
        .update({
          messages,
          last_user_message: input.last_user,
          last_assistant_message: input.last_assistant,
          updated_at: new Date().toISOString()
        })
        .eq('id', (existing.data as ConversationRow).id);
      if (error) throw new Error(`Failed to save conversation: ${error.message}`);
      return;
    }

    const { error } = await supabase.from('conversations').insert({
      business_id: input.business_id,
      session_id: input.session_id,
      messages,
      last_user_message: input.last_user,
      last_assistant_message: input.last_assistant,
      updated_at: new Date().toISOString()
    });

    if (error) throw new Error(`Failed to save conversation: ${error.message}`);
  }

  async createBooking(input: {
    business_id: string;
    service: string;
    start_time: string;
    end_time: string;
    customer_name: string;
    phone: string;
    email?: string;
    status: 'confirmed' | 'requested';
    calendar_event_id?: string;
    notes?: string;
  }): Promise<BookingRow> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        business_id: input.business_id,
        service: input.service,
        start_time: input.start_time,
        end_time: input.end_time,
        customer_name: input.customer_name,
        customer_phone: input.phone,
        customer_email: input.email ?? null,
        status: input.status,
        calendar_event_id: input.calendar_event_id ?? null,
        notes: input.notes ?? null
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as BookingRow;
  }

  async createHandoff(input: {
    business_id: string;
    summary: string;
    last_user_message: string;
    customer_contact: string;
    channel: string;
  }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const safeChannel = ['widget', 'phone', 'email', 'whatsapp', 'instagram'].includes(input.channel) ? input.channel : 'widget';
    const { error } = await supabase.from('handoffs').insert({
      business_id: input.business_id,
      summary: input.summary,
      last_user_message: input.last_user_message,
      customer_contact: { raw: input.customer_contact },
      channel: safeChannel,
      status: 'open'
    });
    if (error) throw new Error(`Failed to create handoff: ${error.message}`);
  }

  async getBookingsInRange(business_id: string, start: string, end: string): Promise<BookingRow[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', business_id)
      .eq('status', 'confirmed')
      .lt('start_time', end)
      .gt('end_time', start)
      .order('start_time');
    if (error) throw new Error(`Failed to get bookings: ${error.message}`);
    return (data || []) as BookingRow[];
  }

  async getGoogleConnection(business_id: string): Promise<{ refresh_token: string; calendar_id: string | null } | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('google_calendar_connections')
      .select('refresh_token, calendar_id')
      .eq('business_id', business_id)
      .maybeSingle();
    if (error) throw new Error(`Failed to get Google connection: ${error.message}`);
    return data as { refresh_token: string; calendar_id: string | null } | null;
  }

  async upsertGoogleConnection(input: { business_id: string; refresh_token: string; calendar_id?: string | null }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('google_calendar_connections')
      .upsert(
        { business_id: input.business_id, refresh_token: input.refresh_token, calendar_id: input.calendar_id ?? 'primary' },
        { onConflict: 'business_id' }
      );
    if (error) throw new Error(`Failed to save Google connection: ${error.message}`);
  }
}

let singleton: Store | null = null;

export function getSupabaseStore(): Store {
  if (!singleton) singleton = new SupabaseStore();
  return singleton;
}
