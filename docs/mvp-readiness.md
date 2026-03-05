# MVP Readiness Gate

Use this checklist before declaring release-ready.

## Platform and Security
- [ ] Admin authentication works and no default passwords remain
- [ ] Owner lockout policy and password policy migrations are applied
- [ ] Widget token secret is set in production
- [ ] CORS headers include required widget headers

## Booking Reliability
- [ ] Booking create idempotency migration is applied
- [ ] Duplicate submit test returns one booking only
- [ ] Calendar connect/start/status pass for admin and owner
- [ ] Cross-tenant owner access is forbidden

## Admin Operations
- [ ] Business health dashboard loads with issues surfaced
- [ ] Admin audit log records business, owner, and SQL actions
- [ ] CSV exports download for bookings and handoffs
- [ ] Privacy delete-session control works

## Regression Suite
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `node scripts/smoke-deployed.mjs`
- [ ] `node scripts/owner-diagnostics.mjs`
- [ ] `node scripts/regression-sweep.mjs`

## Required Migrations
- [ ] `supabase/migrations/007_booking_idempotency_keys.sql`
- [ ] `supabase/migrations/008_admin_audit_logs.sql`
- [ ] `supabase/migrations/009_owner_login_security.sql`
