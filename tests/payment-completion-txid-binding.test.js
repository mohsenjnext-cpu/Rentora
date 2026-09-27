import fs from 'fs';
import assert from 'assert';

const worker = fs.readFileSync('_worker.js', 'utf8');
const start = worker.indexOf("path === '/api/payments/complete'");
assert.ok(start >= 0, 'payment completion route must exist');
const block = worker.slice(start, start + 7000);

assert.ok(
  block.includes("const verifiedTxid = String(payment?.transaction?.txid || '').trim();"),
  'completion must read the transaction ID returned by the verified Pi payment'
);
assert.ok(
  block.includes("const requestedTxid = String(body.txid || '').trim();"),
  'completion must normalize the client transaction ID before comparison'
);
assert.ok(
  block.includes("verifiedTxid !== requestedTxid"),
  'completion must reject a client transaction ID that does not match Pi'
);
assert.ok(
  block.includes("Pi transaction ID does not match the verified payment transaction"),
  'completion must return a clear transaction binding error'
);
assert.ok(
  block.includes("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed'"),
  'completion must persist the verified payment and transaction identifiers'
);

console.log('Pi payment completion transaction binding checks passed.');
