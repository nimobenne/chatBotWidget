create table if not exists booking_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing',
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists booking_idempotency_unique
on booking_idempotency_keys(business_id, idempotency_key);

create index if not exists booking_idempotency_created_idx
on booking_idempotency_keys(created_at desc);
