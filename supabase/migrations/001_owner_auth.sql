-- Phase 1: Owner auth + ownership mapping

create table if not exists business_owners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  owner_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id, owner_user_id)
);

create index if not exists business_owners_owner_idx on business_owners(owner_user_id);
create index if not exists business_owners_business_idx on business_owners(business_id);
