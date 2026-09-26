import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');

test('admin users and KYC view exposes trust counters and bounded controls', () => {
  assert.match(page, /function UsersView\(\{rows,section,busyId,updateUser,onDetails,renderTable\}\)/);
  assert.match(page, /KYC تاییدشده/);
  assert.match(page, /تعلیق‌شده/);
  assert.match(page, /section === 'users-kyc'/);
  assert.match(page, /Verify KYC/);
  assert.match(page, /Suspend/);
});
