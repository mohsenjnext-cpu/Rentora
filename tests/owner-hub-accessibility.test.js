import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/OwnerHubPage.jsx', 'utf8');

test('owner listing filter tabs expose tab semantics and selection state', () => {
  assert.ok(source.includes('role="tablist"'));
  assert.ok(source.includes('aria-selected={activeTab === tab}'));
  assert.ok(source.includes('role="tab"'));
});

test('owner listing selection is keyboard accessible', () => {
  assert.ok(source.includes('onClick={() => onSelectItem(item)}'));
  assert.ok(source.includes('aria-label={l(`مشاهده آگهی ${item.title || \'\'}'));
  assert.ok(source.includes('View listing ${item.title || \'\'}'));
});

test('owner listing toggle exposes pressed state and accessible name', () => {
  assert.ok(source.includes('aria-pressed={isItemActive}'));
  assert.ok(source.includes('Pause listing ${item.title || \'\'}'));
  assert.ok(source.includes('Activate listing ${item.title || \'\'}'));
});