import fs from 'fs';
import assert from 'assert';

const worker = fs.readFileSync('_worker.js', 'utf8');
const start = worker.indexOf("path === '/api/payments/incomplete'");
assert.ok(start >= 0, 'incomplete payment recovery handler must exist');
const block = worker.slice(start, start + 6500);

for (const required of [
  "FROM payment_intents pi",
  "JOIN users u ON u.id = pi.user_id",
  "WHERE pi.pi_payment_id=?1",
  "validatePiPayment(payment, intent, owner)",
  "payment?.status?.transaction_verified !== true",
  "UPDATE rentals SET payment_status='completed',status='confirmed'",
  "INSERT OR IGNORE INTO transactions"
]) {
  assert.ok(block.includes(required), `incomplete recovery must enforce: ${required}`);
}

assert.ok(
  !block.includes("UPDATE payment_intents SET status='completed', pi_txid=?1, updated_at=?2 WHERE pi_payment_id=?3"),
  'incomplete recovery must not settle a payment by payment id alone'
);

console.log('Incomplete Pi payment authority checks passed.');
