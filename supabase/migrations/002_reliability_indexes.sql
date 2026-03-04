-- Phase 1 reliability indexes and constraints for high-volume reads

create index if not exists bookings_business_created_idx
  on bookings(business_id, created_at desc);

create index if not exists bookings_business_start_idx
  on bookings(business_id, start_time);

create index if not exists conversations_business_session_created_idx
  on conversations(business_id, session_id, created_at desc);

create index if not exists google_calendar_connections_business_idx
  on google_calendar_connections(business_id);
