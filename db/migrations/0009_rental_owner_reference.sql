-- Migration 0009: authoritative rental owner reference
-- Keep rental ownership server-derived from the listing owner so rental queries
-- never depend on a browser-supplied owner identity.

ALTER TABLE rentals ADD COLUMN owner_user_id TEXT REFERENCES users(id);

UPDATE rentals
SET owner_user_id = (
  SELECT l.owner_user_id
  FROM listings l
  WHERE l.id = rentals.listing_id
)
WHERE owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rentals_owner ON rentals(owner_user_id);

CREATE TRIGGER IF NOT EXISTS rentals_owner_reference_insert
AFTER INSERT ON rentals
FOR EACH ROW
BEGIN
  UPDATE rentals
  SET owner_user_id = (
    SELECT l.owner_user_id
    FROM listings l
    WHERE l.id = NEW.listing_id
  )
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rentals_owner_reference_listing_update
AFTER UPDATE OF listing_id ON rentals
FOR EACH ROW
BEGIN
  UPDATE rentals
  SET owner_user_id = (
    SELECT l.owner_user_id
    FROM listings l
    WHERE l.id = NEW.listing_id
  )
  WHERE id = NEW.id;
END;
