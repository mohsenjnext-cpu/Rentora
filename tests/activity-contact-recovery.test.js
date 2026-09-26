import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/ActivityPage.jsx', 'utf8');

test('activity contact failure exposes a real retry action', () => {
  assert.match(source, /contactError \? \(/);
  assert.match(source, /onClick=\{\(\) => selectedContactRental && handleOpenContactModal\(selectedContactRental\)\}/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('activity contact retry reuses the server contact fetch path', () => {
  assert.match(source, /const handleOpenContactModal = async \(rental\)/);
  assert.match(source, /await fetchRentalContact\(rental\.id\)/);
});
