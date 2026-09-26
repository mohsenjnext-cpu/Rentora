import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = fs.readFileSync(new URL('../src/components/ReviewModal.jsx', import.meta.url), 'utf8');

test('Review modal does not auto-close through a timer after submission', () => {
  assert.doesNotMatch(file, /setTimeout/);
  assert.match(file, /setSubmitted\(true\)/);
});

test('Review modal rating, close, and submit actions meet touch target baseline', () => {
  assert.match(file, /min-h-11 min-w-11 p-1\.5 transition/);
  assert.match(file, /btn-primary min-h-11 w-full/);
  assert.match(file, /btn-secondary min-h-11 w-full/);
});
