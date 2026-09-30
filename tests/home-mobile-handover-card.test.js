import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Home mobile keeps only the handover trust card', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('min-h-[92px]'));
  assert.ok(source.includes("t('homeStatHandover')"));
  assert.ok(source.includes('Pickup handover confirmation'));
  assert.ok(!source.includes("t('homeStatItems')"));
  assert.ok(!source.includes('دسته‌های فعال'));
  assert.ok(!source.includes('activeCategoryCount'));
  assert.ok(!source.includes('grid grid-cols-3'));
});
