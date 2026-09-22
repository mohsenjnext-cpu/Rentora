CREATE TABLE IF NOT EXISTS payout_operations (
  id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('processing', 'approved', 'pending', 'completed', 'failed')),
  amount REAL NOT NULL CHECK (amount > 0),
  user_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payment_id TEXT,
  txid TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_operations_payment_id
  ON payout_operations(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_operations_status_updated
  ON payout_operations(status, updated_at);
