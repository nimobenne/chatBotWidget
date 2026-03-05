create table if not exists owner_login_security (
  username text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists owner_login_security_locked_idx
on owner_login_security(locked_until);
