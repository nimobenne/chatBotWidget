create or replace function public.admin_run_sql(p_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows bigint := 0;
begin
  if p_sql is null or btrim(p_sql) = '' then
    raise exception 'SQL is required';
  end if;

  execute p_sql;
  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'ok', true,
    'rowsAffected', v_rows
  );
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', sqlerrm
  );
end;
$$;

revoke all on function public.admin_run_sql(text) from public;
grant execute on function public.admin_run_sql(text) to service_role;
