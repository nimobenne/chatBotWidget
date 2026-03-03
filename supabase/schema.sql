-- Run this in Supabase SQL Editor to create the required tables

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  businessId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  hours JSONB NOT NULL DEFAULT '{}',
  services JSONB NOT NULL DEFAULT '[]',
  policies JSONB NOT NULL DEFAULT '{"cancellation": "", "booking": ""}',
  contact JSONB NOT NULL DEFAULT '{}',
  faq JSONB,
  allowedDomains JSONB NOT NULL DEFAULT '[]',
  bookingMode TEXT NOT NULL DEFAULT 'request',
  styling JSONB,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  bookingId TEXT PRIMARY KEY,
  businessId TEXT NOT NULL REFERENCES businesses(businessId),
  serviceName TEXT NOT NULL,
  startTimeISO TEXT NOT NULL,
  endTimeISO TEXT NOT NULL,
  customerName TEXT NOT NULL,
  customerPhone TEXT NOT NULL,
  customerEmail TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Handoffs table
CREATE TABLE IF NOT EXISTS handoffs (
  handoffId TEXT PRIMARY KEY,
  businessId TEXT NOT NULL REFERENCES businesses(businessId),
  summary TEXT NOT NULL,
  customerContact TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  businessId TEXT NOT NULL REFERENCES businesses(businessId),
  sessionId TEXT NOT NULL,
  userMessage TEXT NOT NULL,
  assistantMessage TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Allow public read on businesses
CREATE POLICY "Public businesses read" ON businesses FOR SELECT USING (true);

-- Allow public insert on bookings (you may want to restrict this)
CREATE POLICY "Public bookings insert" ON bookings FOR INSERT WITH CHECK (true);

-- Allow public insert on handoffs
CREATE POLICY "Public handoffs insert" ON handoffs FOR INSERT WITH CHECK (true);

-- Allow public insert on conversations
CREATE POLICY "Public conversations insert" ON conversations FOR INSERT WITH CHECK (true);
