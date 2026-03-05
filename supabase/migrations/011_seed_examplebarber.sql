insert into businesses (
  slug, name, timezone, hours, services, policies, phone, email, address, allowed_domains, booking_mode, slot_interval_min, buffer_min, booking_window_days
) values (
  'examplebarber',
  'Example Barber',
  'America/New_York',
  '{"monday":{"open":"09:00","close":"18:00"},"tuesday":{"open":"09:00","close":"18:00"},"wednesday":{"open":"09:00","close":"18:00"},"thursday":{"open":"09:00","close":"18:00"},"friday":{"open":"09:00","close":"18:00"},"saturday":{"open":"10:00","close":"16:00"},"sunday":null}'::jsonb,
  '[{"name":"Classic Haircut","durationMin":30,"priceRange":"$30-$40","bufferMin":10}]'::jsonb,
  '{"booking":"Appointments recommended","cancellation":"12h notice"}'::jsonb,
  '+1-555-0100',
  'example@widgetai.app',
  '100 Main St',
  '["localhost","127.0.0.1"]'::jsonb,
  'calendar',
  30, 10, 30
)
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  updated_at = now();

insert into business_billing (
  business_id, billing_status, plan_amount_eur, setup_fee_eur, setup_fee_waived, trial_booking_threshold, go_live_enabled, test_mode_enabled
)
select id, 'trial_unpaid', 50, 99, true, 5, false, false
from businesses
where slug = 'examplebarber'
on conflict (business_id) do nothing;
