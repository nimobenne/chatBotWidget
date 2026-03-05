create table if not exists business_billing (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  billing_status text not null default 'trial_unpaid',
  plan_amount_eur integer not null default 50,
  setup_fee_eur integer not null default 99,
  setup_fee_waived boolean not null default true,
  trial_booking_threshold integer not null default 5,
  paypal_email text,
  paypal_subscription_id text,
  notes text,
  go_live_enabled boolean not null default false,
  test_mode_enabled boolean not null default false,
  checklist_test_booking_passed boolean not null default false,
  billing_started_at timestamptz,
  next_billing_due_at timestamptz,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_billing_status_idx on business_billing(billing_status);
create index if not exists business_billing_due_idx on business_billing(next_billing_due_at);
