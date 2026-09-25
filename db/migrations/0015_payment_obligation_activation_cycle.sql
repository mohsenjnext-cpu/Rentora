-- Migration 0015: activation-cycle identity for owner fee obligations
PRAGMA foreign_keys = ON;

-- Owner activation obligations are listing-scoped, but a listing can be
-- activated more than once over its lifetime. Persist the cycle on the
-- obligation so payment metadata can bind to the exact activation attempt.
ALTER TABLE payment_obligations ADD COLUMN activation_cycle TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_obligations_activation_cycle
  ON payment_obligations(activation_cycle);

-- The original listing-scoped unique index allowed only one owner obligation
-- for the entire lifetime of a listing. Replace it with cycle-scoped
-- uniqueness so a cancelled/failed activation can be retried in a new cycle.
DROP INDEX IF EXISTS uq_payment_obligations_listing_role_purpose;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_obligations_listing_role_purpose_cycle
  ON payment_obligations(listing_id, role, purpose, activation_cycle)
  WHERE listing_id IS NOT NULL AND rental_id IS NULL;
