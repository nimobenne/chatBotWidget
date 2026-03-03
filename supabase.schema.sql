-- Supabase schema for chatBotWidget
-- Run in Supabase SQL editor for a clean setup that matches current app code.

create extension if not exists btree_gist;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Berlin',
  phone text,
  email text,
  address text,
  hours jsonb not null default '{}'::jsonb,
  services jsonb not null default '[]'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  allowed_domains text[] not null default array['localhost','127.0.0.1'],
  booking_mode text not null default 'calendar' check (booking_mode in ('calendar','request')),
  slot_interval_min integer not null default 15,
  buffer_min integer not null default 5,
  booking_window_days integer not null default 14,
  widget_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  status text not null default 'confirmed' check (status in ('confirmed','requested','cancelled')),
  calendar_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  constraint bookings_valid_range check (end_time > start_time)
);

-- Prevent overlap for confirmed bookings only.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap_confirmed'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap_confirmed
      exclude using gist (
        business_id with =,
        tstzrange(start_time, end_time, '[)') with &&
      ) where (status = 'confirmed');
  end if;
end$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_id text not null,
  messages jsonb not null default '[]'::jsonb,
  last_user_message text,
  last_assistant_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_business_session_idx
  on public.conversations (business_id, session_id);

create table if not exists public.google_calendar_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  calendar_id text not null default 'primary',
  refresh_token text not null,
  scope text,
  token_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved')),
  summary text not null,
  last_user_message text,
  customer_contact jsonb not null default '{}'::jsonb,
  channel text not null default 'widget' check (channel in ('widget','phone','email','whatsapp','instagram')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
