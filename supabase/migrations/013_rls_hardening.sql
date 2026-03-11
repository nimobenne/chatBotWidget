-- ============================================================================
-- RLS Hardening: replace open (true) policies with scoped ones
-- ============================================================================

-- ── businesses ──────────────────────────────────────────────────────────────
-- Keep public SELECT (widget needs to read config), remove any write via anon
DROP POLICY IF EXISTS "Public businesses read" ON businesses;
CREATE POLICY "anon_read_businesses" ON businesses FOR SELECT USING (true);

-- ── bookings ────────────────────────────────────────────────────────────────
-- INSERT: only if business_id references a real business
-- SELECT: allowed (needed for conflict checks in API routes)
DROP POLICY IF EXISTS "Public bookings insert" ON bookings;
CREATE POLICY "anon_insert_bookings" ON bookings
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses));
CREATE POLICY "anon_read_bookings" ON bookings
  FOR SELECT USING (true);

-- ── handoffs ────────────────────────────────────────────────────────────────
-- INSERT only with valid business_id
DROP POLICY IF EXISTS "Public handoffs insert" ON handoffs;
CREATE POLICY "anon_insert_handoffs" ON handoffs
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses));

-- ── conversations ───────────────────────────────────────────────────────────
-- INSERT with valid business_id, SELECT for history, DELETE for pruning/privacy
DROP POLICY IF EXISTS "Public conversations insert" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses));
CREATE POLICY "anon_read_conversations" ON conversations
  FOR SELECT USING (true);
CREATE POLICY "anon_delete_conversations" ON conversations
  FOR DELETE USING (true);

-- ── google_calendar_connections ─────────────────────────────────────────────
-- Service role only (contains refresh tokens — most sensitive table)
DROP POLICY IF EXISTS "Public google_calendar_connections all" ON google_calendar_connections;
CREATE POLICY "service_role_only_gcc" ON google_calendar_connections
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── business_owners ─────────────────────────────────────────────────────────
ALTER TABLE business_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_bo" ON business_owners
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── business_billing ────────────────────────────────────────────────────────
ALTER TABLE business_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_billing" ON business_billing
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── booking_idempotency_keys ────────────────────────────────────────────────
ALTER TABLE booking_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_idempotency" ON booking_idempotency_keys
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses));
CREATE POLICY "anon_read_idempotency" ON booking_idempotency_keys
  FOR SELECT USING (true);
CREATE POLICY "anon_delete_idempotency" ON booking_idempotency_keys
  FOR DELETE USING (true);

-- ── admin_audit_logs ────────────────────────────────────────────────────────
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_audit" ON admin_audit_logs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── owner_login_security ────────────────────────────────────────────────────
ALTER TABLE owner_login_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_login_sec" ON owner_login_security
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
