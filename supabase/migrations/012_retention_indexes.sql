-- Indexes to speed up retention/pruning deletes
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_booking_idempotency_keys_created_at ON booking_idempotency_keys(created_at);
