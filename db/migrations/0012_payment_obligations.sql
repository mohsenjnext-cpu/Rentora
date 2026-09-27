-- Migration 0012: server-authoritative payment obligations for shared 50/50 platform fees
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS payment_obligations (
  id TEXT PRIMARY KEY,
  rental_id TEXT REFERENCES rentals(id) ON DELETE SET NULL,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','renter')),
  purpose TEXT NOT NULL CHECK (purpose IN ('platform_fee')),
  amount REAL NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PI' CHECK (currency = 'PI'),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','approved','completed','cancelled','failed')),
  pi_payment_id TEXT UNIQUE,
  pi_txid TEXT UNIQUE,
  memo TEXT NOT NULL,
  metadata TEXT,
  idempotency_key TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_rental
  ON payment_obligations(rental_id);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_listing
  ON payment_obligations(listing_id);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_user_status
  ON payment_obligations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_role_purpose_status
  ON payment_obligations(role, purpose, status);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_pi_payment
  ON payment_obligations(pi_payment_id);

-- At most one obligation for each role/purpose on a given rental.
-- Owner obligations use listing_id and rental_id=NULL during listing activation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_obligations_rental_role_purpose
  ON payment_obligations(rental_id, role, purpose)
  WHERE rental_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_obligations_listing_role_purpose
  ON payment_obligations(listing_id, role, purpose)
  WHERE listing_id IS NOT NULL AND rental_id IS NULL;

-- Add explicit shared-fee fields while preserving legacy platform_fee for compatibility.
ALTER TABLE rentals ADD COLUMN platform_fee_total REAL;
ALTER TABLE rentals ADD COLUMN owner_platform_fee REAL;
ALTER TABLE rentals ADD COLUMN renter_platform_fee REAL;
ALTER TABLE rentals ADD COLUMN owner_fee_payment_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (owner_fee_payment_status IN ('not_required','unpaid','pending','approved','completed','failed','cancelled'));
ALTER TABLE rentals ADD COLUMN renter_fee_payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (renter_fee_payment_status IN ('not_required','unpaid','pending','approved','completed','failed','cancelled'));
ALTER TABLE rentals ADD COLUMN owner_fee_payment_id TEXT;
ALTER TABLE rentals ADD COLUMN renter_fee_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rentals_owner_fee_status
  ON rentals(owner_fee_payment_status);

CREATE INDEX IF NOT EXISTS idx_rentals_renter_fee_status
  ON rentals(renter_fee_payment_status);

-- Transaction linkage to the economic obligation. Existing rows remain valid.
ALTER TABLE transactions ADD COLUMN rental_id TEXT;
ALTER TABLE transactions ADD COLUMN listing_id TEXT;
ALTER TABLE transactions ADD COLUMN payment_obligation_id TEXT;
ALTER TABLE transactions ADD COLUMN fee_role TEXT;
ALTER TABLE transactions ADD COLUMN purpose TEXT NOT NULL DEFAULT 'platform_fee';

CREATE INDEX IF NOT EXISTS idx_transactions_obligation
  ON transactions(payment_obligation_id);

CREATE INDEX IF NOT EXISTS idx_transactions_rental
  ON transactions(rental_id);

CREATE INDEX IF NOT EXISTS idx_transactions_listing
  ON transactions(listing_id);

CREATE INDEX IF NOT EXISTS idx_transactions_fee_role
  ON transactions(fee_role, purpose);

-- Backfill the explicit total from the legacy authoritative platform_fee.
UPDATE rentals
SET platform_fee_total = platform_fee
WHERE platform_fee_total IS NULL;

-- Historical rentals are renter-paid under the old model. Preserve that fact;
-- do not manufacture owner payments from historical Pi transactions.
UPDATE rentals
SET renter_platform_fee = platform_fee,
    owner_platform_fee = 0
WHERE renter_platform_fee IS NULL;

UPDATE rentals
SET renter_fee_payment_status =
      CASE
        WHEN payment_status = 'completed' THEN 'completed'
        WHEN payment_status = 'pending' THEN 'pending'
        WHEN payment_status = 'approved' THEN 'approved'
        WHEN payment_status = 'failed' THEN 'failed'
        WHEN payment_status = 'cancelled' THEN 'cancelled'
        ELSE 'unpaid'
      END
WHERE renter_fee_payment_status = 'unpaid'
  AND platform_fee_total IS NOT NULL;
