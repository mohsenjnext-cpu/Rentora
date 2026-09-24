-- Migration 0014: authoritative listing activation state for owner platform fees
PRAGMA foreign_keys = ON;

-- The listing, not the rental, owns the lifecycle of the owner's platform-fee
-- obligation. A new activation cycle must therefore be queryable directly from
-- listings without manufacturing a rental record.
ALTER TABLE listings ADD COLUMN activation_cycle TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE listings ADD COLUMN owner_fee_payment_status TEXT NOT NULL DEFAULT 'legacy_unverified'
  CHECK (owner_fee_payment_status IN ('legacy_unverified','unpaid','pending','approved','completed','failed','cancelled'));
ALTER TABLE listings ADD COLUMN owner_fee_obligation_id TEXT;
ALTER TABLE listings ADD COLUMN activated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_activation_cycle
  ON listings(id, activation_cycle);

CREATE INDEX IF NOT EXISTS idx_listings_owner_fee_status
  ON listings(owner_fee_payment_status);

CREATE INDEX IF NOT EXISTS idx_listings_owner_activation
  ON listings(owner_user_id, activation_cycle);

-- Do not synthesize historical owner payments. Existing listings are explicitly
-- marked legacy_unverified so the application can require a real owner-fee
-- activation before treating them as newly bookable.
