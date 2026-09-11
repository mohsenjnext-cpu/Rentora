-- Strengthen payment replay protection on existing D1 databases.
-- NULL pi_payment_id values are allowed until a Pi payment is bound.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_pi_payment_id
  ON payment_intents(pi_payment_id)
  WHERE pi_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_pi_txid
  ON payment_intents(pi_txid)
  WHERE pi_txid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_rental_status
  ON payment_intents(rental_id, status);
