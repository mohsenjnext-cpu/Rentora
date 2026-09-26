import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');

test('admin overview exposes a needs-attention operational queue', () => {
  assert.match(page, /function NeedsAttention\(\{ reports, payouts, go \}\)/);
  assert.match(page, /Needs Attention/);
  assert.match(page, /reconciliation_required/);
  assert.match(page, /go\('reports-open'\)/);
  assert.match(page, /go\('payout-reconcile'\)/);
});


test('admin audit view exposes operational audit summaries', () => {
  assert.match(fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8'), /function AuditView\(\{audit\}\)/);
  assert.match(fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8'), /Total Events/);
  assert.match(fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8'), /Action Types/);
  assert.match(fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8'), /داده‌های ثبت‌شده را فقط نمایش می‌دهد/);
});


test('admin dashboard keeps production-safe lightweight imports', () => {
  const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /useMemo/);
  assert.doesNotMatch(page, /currentUser \}/);
  assert.match(page, /function AuditView\(\{audit\}\)/);
});
