import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');

test('admin listings view exposes moderation state and operational counters', () => {
  assert.match(page, /section==='listings-moderation'/);
  assert.match(page, /function ListingsView\(\{rows,section,busyId,updateListing,renderTable\}\)/);
  assert.match(page, /\['pending','moderation','pending_moderation','review'\]/);
  assert.match(page, /\['Active',active\],\['Paused',paused\],\['Moderation',moderation\]/);
  assert.match(page, /تغییر وضعیت فقط از مسیر مدیریتی و سرویس سمت سرور انجام می‌شود/);
});