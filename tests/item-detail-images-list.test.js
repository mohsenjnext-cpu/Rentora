import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Item Detail derives gallery images from detailItem before item is declared', () => {
  const source = fs.readFileSync(new URL('../src/pages/ItemDetailPage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('const imagesList = Array.isArray(detailItem?.images) ? detailItem.images.filter(Boolean) : [];'));
  assert.ok(!source.includes('const imagesList = Array.isArray(detailItem?.images) ? item.images.filter(Boolean) : [];'));
});