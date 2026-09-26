import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/ActivityPage.jsx', 'utf8');

test('activity filters expose tab semantics', () => {
  assert.ok(source.includes('role="tablist" aria-label={l('));
  assert.ok(source.includes('role="tab" aria-selected={activityFilter === key}'));
});

test('rental workspace tabs expose selected state and connected panels', () => {
  assert.ok(source.includes('role="tab" aria-selected={activeTab === \'active\'} aria-controls="activity-rentals-panel"'));
  assert.ok(source.includes('role="tab"') && source.includes("aria-selected={activeTab === 'history'}") && source.includes('aria-controls="activity-rental-history-panel"'));
  assert.ok(source.includes('id="activity-rentals-panel" role="tabpanel"'));
  assert.ok(source.includes('id="activity-rental-history-panel" role="tabpanel"'));
});
