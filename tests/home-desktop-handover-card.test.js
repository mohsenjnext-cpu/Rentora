import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Home desktop handover card has an explicit confirmation state without an empty metric slot', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('<div className="flex items-center justify-center gap-1 text-[var(--trust-text)]">'));
  assert.ok(source.includes('<CheckCircle2 className="w-4 h-4" aria-hidden="true" />'));
  assert.ok(source.includes("t('homeStatHandover')"));
  assert.ok(!source.includes('<div className="text-lg font-black text-slate-900 dark:text-white"></div>'));
});