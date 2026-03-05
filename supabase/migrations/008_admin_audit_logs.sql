create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
on admin_audit_logs(created_at desc);

create index if not exists admin_audit_logs_action_idx
on admin_audit_logs(action);
