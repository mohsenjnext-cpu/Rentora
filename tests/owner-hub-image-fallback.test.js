import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Owner Hub does not use a remote mock image fallback for listings', () => {
  const source = fs.readFileSync(new URL('../src/pages/OwnerHubPage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes("item.images?.[0] ? ("));
  assert.ok(source.includes('<Package className="w-5 h-5 stroke-[1.6]" />'));
  assert.ok(!source.includes('images.unsplash.com'));
});
