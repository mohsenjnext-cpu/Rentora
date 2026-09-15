-- Migration 0008: Authoritative rental overlap protection
-- Prevent two active/reserved rentals for the same listing from overlapping.
-- pending_payment reservations are considered holds for 30 minutes so an
-- abandoned payment cannot block a listing forever.

CREATE INDEX IF NOT EXISTS idx_rentals_listing_dates_status
  ON rentals(listing_id, start_date, end_date, status);

CREATE TRIGGER IF NOT EXISTS rentals_overlap_guard_insert
BEFORE INSERT ON rentals
FOR EACH ROW
WHEN NEW.status IN ('pending_payment','paid','confirmed','active')
  AND EXISTS (
    SELECT 1
    FROM rentals r
    WHERE r.listing_id = NEW.listing_id
      AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (
        r.status <> 'pending_payment'
        OR julianday(r.created_at) >= julianday('now','-30 minutes')
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
    SELECT 1
    FROM rentals r
    WHERE r.listing_id = NEW.listing_id
      AND r.id <> NEW.id
      AND r.status IN ('pending_payment','paid','confirmed','active')
      AND julianday(r.end_date) > julianday(NEW.start_date)
      AND julianday(r.start_date) < julianday(NEW.end_date)
      AND (
        r.status <> 'pending_payment'
        OR julianday(r.created_at) >= julianday('now','-30 minutes')
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'listing is already reserved for the requested dates');
END;
