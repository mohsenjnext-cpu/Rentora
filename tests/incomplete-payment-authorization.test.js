import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const start = worker.indexOf("path === '/api/payments/incomplete'");
const end = worker.indexOf("path === '/api/sync/item'", start);
assert.ok(start >= 0 && end > start, 'incomplete payment route must exist');
const route = worker.slice(start, end);

test('incomplete Pi payment recovery requires an authenticated session', () => {
  assert.match(route, /const \{ user \} = await requireUser\(request, env\)/);
});

test('incomplete Pi recovery must resolve the payment intent to its owning user', () => {
  assert.match(route, /WHERE pi\.pi_payment_id=\?1 LIMIT 1/);
  assert.match(route, /intent\.user_id/);
  assert.match(route, /user\.id/);
});
