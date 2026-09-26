import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');

test('admin reports view exposes trust and safety counters', () => {
  assert.match(page, /function ReportsView\(\{rows,busyId,updateReport,renderTable\}\)/);
  assert.match(page, /\['Open',open\],\['Reviewing',reviewing\],\['Resolved',resolved\]/);
  assert.match(page, /Trust & Safety/);
  assert.match(page, /r.status==='open'/);
  assert.match(page, /r.status==='reviewing'/);
});