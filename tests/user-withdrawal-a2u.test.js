import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

test('Legacy user wallet withdrawal route is disabled with 410', async () => {
  const response = await worker.fetch(new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 5 })
  }), {
    CORS_ORIGIN: 'http://localhost'
  });

  assert.equal(response.status, 410);
  const data = await response.json();
  assert.match(data.error, /برداشت مستقیم موقتاً غیرفعال است/);
});

test('Legacy withdrawal route does not expose synthetic payout behavior', async () => {
  const response = await worker.fetch(new Request('http://localhost/api/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 999999, userId: 'attacker' })
  }), {
    CORS_ORIGIN: 'http://localhost'
  });

  assert.equal(response.status, 410);
  const data = await response.json();
  assert.equal(data.success, undefined);
  assert.equal(data.paymentId, undefined);
  assert.equal(data.txid, undefined);
});
