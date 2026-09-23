-- Migration 0010: Payout operations table for A2U idempotent state machine
CREATE TABLE IF NOT EXISTS payout_operations (
  id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'reserved', 'creating', 'pi_created', 'approving', 'approved',
    'completing', 'completed', 'cancelled', 'reconciliation_required'
  )),
  amount REAL NOT NULL CHECK (amount > 0),
  user_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  pi_payment_id TEXT UNIQUE,
  txid TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reservation_expires_at TEXT,
  lease_owner TEXT,
  lease_expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payout_operations_status_updated
  ON payout_operations(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_payout_operations_payment_id
  ON payout_operations(pi_payment_id);

CREATE TABLE IF NOT EXISTS payout_reconciliation_queue (
  id TEXT PRIMARY KEY,
  pi_payment_id TEXT UNIQUE,
  operation_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('reconciliation_required', 'resolved')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_reconciliation_queue_status
  ON payout_reconciliation_queue(status, updated_at);

CREATE TRIGGER IF NOT EXISTS payout_operations_transition_guard
BEFORE UPDATE OF status ON payout_operations
FOR EACH ROW
WHEN NEW.status <> OLD.status
  AND NOT (
    (OLD.status = 'reserved' AND NEW.status IN ('creating','cancelled','reconciliation_required')) OR
    (OLD.status = 'creating' AND NEW.status IN ('pi_created','cancelled','reconciliation_required')) OR
    (OLD.status = 'pi_created' AND NEW.status IN ('approving','cancelled','reconciliation_required')) OR
    (OLD.status = 'approving' AND NEW.status IN ('approved','completed','cancelled','reconciliation_required')) OR
    (OLD.status = 'approved' AND NEW.status IN ('completing','completed','cancelled','reconciliation_required')) OR
    (OLD.status = 'completing' AND NEW.status IN ('completed','cancelled','reconciliation_required')) OR
    (OLD.status IN ('completed','cancelled','reconciliation_required') AND NEW.status = OLD.status) OR
    (OLD.status = 'reconciliation_required' AND NEW.status IN ('approving','approved','completing','completed','cancelled','reconciliation_required'))
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid payout operation transition');
END;
