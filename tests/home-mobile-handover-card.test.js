import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Home mobile handover card uses an explicit confirmation state without a fake metric', () => {
  const source = fs.readFileSync(new URL('../src/pages/HomePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /CheckCircle2 className="w-5 h-5 mx-auto text-\[var\(--trust-text\)\]"/);
  assert.match(source, /Pickup handover confirmation/);
  assert.doesNotMatch(source, /text-\[18px\] font-black text-\[var\(--trust-text\]\"><\\/div><div className="text-\[10px\] font-bold text-\[var\(--trust-text\)\]/);
});
