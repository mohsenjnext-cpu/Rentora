-- Migration 0013: activation-cycle identity for owner platform-fee obligations
PRAGMA foreign_keys = ON;

ALTER TABLE payment_obligations ADD COLUMN activation_cycle TEXT NOT NULL DEFAULT 'initial';

DROP INDEX IF EXISTS uq_payment_obligations_listing_role_purpose;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_obligations_listing_role_purpose_cycle
  ON payment_obligations(listing_id, role, purpose, activation_cycle)
  WHERE listing_id IS NOT NULL AND rental_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_obligations_listing_cycle
  ON payment_obligations(listing_id, activation_cycle);
