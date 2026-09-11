-- D1/SQLite guard for listing lifecycle transitions.
-- Browser requests may reach the Worker with a status field, so the database
-- must reject arbitrary status changes even if an application-layer check is
-- accidentally bypassed or regresses later.
-- Allowed transitions:
--   active -> paused
--   paused -> active
--   active/paused -> deleted
--   same status -> same status
CREATE TRIGGER IF NOT EXISTS listings_status_transition_guard
BEFORE UPDATE OF status ON listings
FOR EACH ROW
WHEN NEW.status <> OLD.status
  AND NOT (
    (OLD.status = 'active' AND NEW.status IN ('paused', 'deleted'))
    OR (OLD.status = 'paused' AND NEW.status IN ('active', 'deleted'))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid listing status transition');
END;

CREATE INDEX IF NOT EXISTS idx_listings_owner_status
  ON listings(owner_user_id, status);
