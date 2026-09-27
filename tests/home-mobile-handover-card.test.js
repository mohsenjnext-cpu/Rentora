import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Home mobile handover card uses an explicit confirmation state without a fake metric', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.ok(source.includes('CheckCircle2 className="w-5 h-5 mx-auto text-[var(--trust-text)]"'));
  assert.ok(source.includes('Pickup handover confirmation'));
  assert.ok(!source.includes('<div className="text-[18px] font-black text-[var(--trust-text)]"></div>'));
});
