import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

test('listing writes require an authenticated server-side user', () => {
  assert.match(worker, /path === '\/api\/sync\/item'\) \{ const \{ user \} = await requireUser\(request, env\)/);
});

test('existing listing updates enforce ownership or explicit admin authority', () => {
  assert.match(worker, /existing\.owner_user_id !== user\.id && !isAdmin\(user\.pi_uid, env\)/);
});

test('listing updates preserve server-owned price and deposit', () => {
  assert.match(worker, /const price = Number\(existing\.price_per_day\); const deposit = Number\(existing\.deposit_amount\)/);
  assert.match(worker, /pricePerDay: price, deposit \}/);
});

test('new listings bind ownership to the authenticated D1 user', () => {
  assert.match(worker, /INSERT INTO listings\(id,owner_user_id,title,description,category,location,price_per_day,deposit_amount/);
  assert.match(worker, /\.bind\(item\.id, user\.id, String\(item\.title\)/);
});

test('listing price and deposit are validated server-side', () => {
  assert.match(worker, /!Number\.isFinite\(price\) \|\| price < 0 \|\| !Number\.isFinite\(deposit\) \|\| deposit < 0/);
});
