import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');
test('admin transactions view exposes payment operations summary', () => {
  assert.match(page, /section\.startsWith\('transactions'\)/);
  assert.match(page, /\['Platform Fees',fees\],\['Payouts',payoutRows\]/);
  assert.match(page, /\['Completed',completed\],\['Pending',pending\]/);
  assert.match(page, /تراکنش‌ها فقط برای مشاهده و تطبیق مدیریتی هستند/);
  assert.match(page, /pi_payment_id/);
  assert.match(page, /pi_txid/);
});