-- Run this in Supabase SQL Editor to create the required tables

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  hours JSONB NOT NULL DEFAULT '{}',
  services JSONB NOT NULL DEFAULT '[]',
  policies JSONB NOT NULL DEFAULT '{"cancellation": "", "booking": ""}',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  faqs JSONB,
  allowed_domains JSONB NOT NULL DEFAULT '[]',
  booking_mode TEXT NOT NULL DEFAULT 'request',
  widget_style JSONB,
  slot_interval_min INTEGER DEFAULT 30,
  buffer_min INTEGER DEFAULT 10,
  booking_window_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  service TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  calendar_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Handoffs table
CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  customer_contact JSONB NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  channel TEXT DEFAULT 'chat',
  status TEXT DEFAULT 'open',
  last_user_message TEXT
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  session_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  last_user_message TEXT,
  last_assistant_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, session_id)
);

-- Google Calendar Connections table
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID UNIQUE NOT NULL REFERENCES businesses(id),
  calendar_id TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Allow public read on businesses
CREATE POLICY "Public businesses read" ON businesses FOR SELECT USING (true);

-- Allow public insert on bookings
CREATE POLICY "Public bookings insert" ON bookings FOR INSERT WITH CHECK (true);

-- Allow public insert on handoffs
CREATE POLICY "Public handoffs insert" ON handoffs FOR INSERT WITH CHECK (true);

-- Allow public insert on conversations
CREATE POLICY "Public conversations insert" ON conversations FOR INSERT WITH CHECK (true);

-- Allow public read/write on google_calendar_connections
CREATE POLICY "Public google_calendar_connections all" ON google_calendar_connections FOR ALL USING (true) WITH CHECK (true);
