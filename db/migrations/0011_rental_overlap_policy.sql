-- Migration 0011: align rental overlap semantics with the authoritative schema
-- Historical 0008 intentionally remains immutable. This forward migration
-- changes the pending-payment hold from 30 minutes to the current 10-minute
-- policy and preserves the same-renter renewal exception used by schema.sql.
DROP TRIGGER IF EXISTS rentals_overlap_guard_insert;
DROP TRIGGER IF EXISTS rentals_overlap_guard_update;

CREATE TRIGGER IF NOT EXISTS rentals_overlap_guard_insert
BEFORE INSERT ON rentals
FOR EACH ROW
WHEN NEW.status IN ('pending_payment','paid','confirmed','active')
  AND EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.listing_id = NEW.listing_id
      AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (
        r.status <> 'pending_payment'
        OR (
          r.renter_user_id <> NEW.renter_user_id
          AND julianday(r.created_at) >= julianday('now','-10 minutes')
        )
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'listing is already reserved for the requested dates');
END;

CREATE TRIGGER IF NOT EXISTS rentals_overlap_guard_update
BEFORE UPDATE OF listing_id, start_date, end_date, status ON rentals
FOR EACH ROW
WHEN NEW.status IN ('pending_payment','paid','confirmed','active')
  AND EXISTS (
    SELECT 1 FROM rentals r
    WHERE r.listing_id = NEW.listing_id
      AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (
        r.status <> 'pending_payment'
        OR (
          r.renter_user_id <> NEW.renter_user_id
          AND julianday(r.created_at) >= julianday('now','-10 minutes')
        )
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'listing is already reserved for the requested dates');
END;
