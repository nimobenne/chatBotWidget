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
  status: 'confirmed' | 'requested';
  calendar_event_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Store {
  getBusinessBySlug(slug: string): Promise<BusinessRow | null>;
  listBusinesses(): Promise<BusinessRow[]>;
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

class SupabaseStore implements Store {
  async getBusinessBySlug(slug: string): Promise<BusinessRow | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('businesses').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new Error(`Failed to load business: ${error.message}`);
    return data as BusinessRow | null;
  }

  async listBusinesses(): Promise<BusinessRow[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('businesses').select('*').order('slug');
    if (error) throw new Error(`Failed to list businesses: ${error.message}`);
    return (data || []) as BusinessRow[];
  }

  async upsertConversation(input: {
    business_id: string;
    session_id: string;
    newMessages: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
    last_user: string;
    last_assistant: string;
  }): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('conversations').upsert(
      {
        business_id: input.business_id,
        session_id: input.session_id,
        transcript: input.newMessages,
        last_user: input.last_user,
        last_assistant: input.last_assistant,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'business_id,session_id' }
    );
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

    if (error) {
      throw new Error(error.message);
    }

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
    const { error } = await supabase.from('handoffs').insert({ ...input, status: 'open' });
    if (error) throw new Error(`Failed to create handoff: ${error.message}`);
  }

  async getBookingsInRange(business_id: string, start: string, end: string): Promise<BookingRow[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', business_id)
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
      .upsert({ business_id: input.business_id, refresh_token: input.refresh_token, calendar_id: input.calendar_id ?? 'primary' }, { onConflict: 'business_id' });
    if (error) throw new Error(`Failed to save Google connection: ${error.message}`);
  }
}

let singleton: Store | null = null;

export function getSupabaseStore(): Store {
  if (!singleton) singleton = new SupabaseStore();
  return singleton;
}
