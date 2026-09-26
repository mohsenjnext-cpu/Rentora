import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = fs.readFileSync(new URL('../src/components/WalletModal.jsx', import.meta.url), 'utf8');

test('Wallet modal does not present A2U-disabled balance as withdrawable', () => {
  assert.match(file, /موجودی تاییدشده شما/);
  assert.match(file, /Your Confirmed Balance/);
  assert.match(file, /User A2U withdrawal is currently disabled/);
  assert.doesNotMatch(file, /Your Withdrawable Balance/);
});

test('Wallet modal does not expose a user withdrawal action', () => {
  assert.doesNotMatch(file, /wallet\/withdraw/);
  assert.doesNotMatch(file, /Withdraw Funds/);
  assert.doesNotMatch(file, /برداشت وجه/);
});
