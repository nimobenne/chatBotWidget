create table if not exists business_intake_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create index if not exists intake_owner_idx on business_intake_requests(owner_user_id);
create index if not exists intake_status_idx on business_intake_requests(status, created_at desc);
