-- Migration 0011: idempotent schema alignment for the current Rentora D1 model.
--
-- This migration is intentionally additive only. It does not ALTER existing
-- columns, copy/rebuild tables, DROP objects, delete rows, or rewrite data.

CREATE TABLE IF NOT EXISTS payout_reconciliation_queue (
  id TEXT PRIMARY KEY,
  pi_payment_id TEXT UNIQUE,
  operation_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('reconciliation_required', 'resolved')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rentals_listing_dates_status ON rentals(listing_id, start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_rental_status ON payment_intents(rental_id, status);
CREATE INDEX IF NOT EXISTS idx_rentals_owner ON rentals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_operations_status_updated ON payout_operations(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_payout_operations_payment_id ON payout_operations(pi_payment_id);
CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_queue_status ON payout_reconciliation_queue(status, updated_at);

CREATE TRIGGER IF NOT EXISTS listings_status_transition_guard
BEFORE UPDATE OF status ON listings FOR EACH ROW
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'active' AND NEW.status IN ('paused', 'deleted'))
  OR (OLD.status = 'paused' AND NEW.status IN ('active', 'deleted'))
)
BEGIN SELECT RAISE(ABORT, 'invalid listing status transition'); END;

CREATE TRIGGER IF NOT EXISTS rentals_overlap_guard_insert
BEFORE INSERT ON rentals FOR EACH ROW
WHEN NEW.status IN ('pending_payment','paid','confirmed','active')
  AND EXISTS (
    SELECT 1 FROM rentals r WHERE r.listing_id = NEW.listing_id AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (r.status <> 'pending_payment' OR (r.renter_user_id <> NEW.renter_user_id AND julianday(r.created_at) >= julianday('now','-10 minutes')))
  )
BEGIN SELECT RAISE(ABORT, 'listing is already reserved for the requested dates'); END;

CREATE TRIGGER IF NOT EXISTS rentals_overlap_guard_update
BEFORE UPDATE OF listing_id, start_date, end_date, status ON rentals FOR EACH ROW
WHEN NEW.status IN ('pending_payment','paid','confirmed','active')
  AND EXISTS (
    SELECT 1 FROM rentals r WHERE r.listing_id = NEW.listing_id AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (r.status <> 'pending_payment' OR (r.renter_user_id <> NEW.renter_user_id AND julianday(r.created_at) >= julianday('now','-10 minutes')))
  )
BEGIN SELECT RAISE(ABORT, 'listing is already reserved for the requested dates'); END;

CREATE TRIGGER IF NOT EXISTS rentals_owner_reference_insert
AFTER INSERT ON rentals FOR EACH ROW
BEGIN
  UPDATE rentals SET owner_user_id = (SELECT l.owner_user_id FROM listings l WHERE l.id = NEW.listing_id) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rentals_owner_reference_listing_update
AFTER UPDATE OF listing_id ON rentals FOR EACH ROW
BEGIN
  UPDATE rentals SET owner_user_id = (SELECT l.owner_user_id FROM listings l WHERE l.id = NEW.listing_id) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS payout_operations_transition_guard
BEFORE UPDATE OF status ON payout_operations FOR EACH ROW
WHEN NEW.status <> OLD.status AND NOT (
  (OLD.status = 'reserved' AND NEW.status IN ('creating','cancelled','reconciliation_required')) OR
  (OLD.status = 'creating' AND NEW.status IN ('pi_created','cancelled','reconciliation_required')) OR
  (OLD.status = 'pi_created' AND NEW.status IN ('approving','cancelled','reconciliation_required')) OR
  (OLD.status = 'approving' AND NEW.status IN ('approved','completed','cancelled','reconciliation_required')) OR
  (OLD.status = 'approved' AND NEW.status IN ('completing','completed','cancelled','reconciliation_required')) OR
  (OLD.status = 'completing' AND NEW.status IN ('completed','cancelled','reconciliation_required')) OR
  (OLD.status IN ('completed','cancelled','reconciliation_required') AND NEW.status = OLD.status) OR
  (OLD.status = 'reconciliation_required' AND NEW.status IN ('approving','approved','completing','completed','cancelled','reconciliation_required'))
)
BEGIN SELECT RAISE(ABORT, 'invalid payout operation transition'); END;
