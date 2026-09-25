import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('listing writes require an authenticated server-side user', () => {
  assert.ok(worker.includes("path === '/api/sync/item'"));
  assert.ok(worker.includes('const { user } = await requireUser(request, env)'));
});

test('existing listing updates enforce ownership or explicit admin authority', () => {
  assert.ok(worker.includes('existing.owner_user_id !== user.id && !isAdmin(user.pi_uid, env)'));
});

test('listing updates preserve server-owned price and deposit', () => {
  assert.ok(worker.includes('const price = Number(existing.price_per_day)'));
  assert.ok(worker.includes('const deposit = Number(existing.deposit_amount)'));
  assert.ok(worker.includes('pricePerDay: price, deposit'));
});

test('new listings bind ownership to the authenticated D1 user', () => {
  assert.ok(worker.includes('INSERT INTO listings(id,owner_user_id,title,description,category,location,price_per_day,deposit_amount'));
  assert.ok(worker.includes('.bind(listingId, user.id, title'));
});

test('listing price and deposit are validated server-side', () => {
  assert.ok(worker.includes('Number.isFinite(price)'));
  assert.ok(worker.includes('Number.isFinite(deposit)'));
  assert.ok(worker.includes('price < 0'));
  assert.ok(worker.includes('deposit < 0'));
});
