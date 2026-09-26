import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/pages/OwnerHubPage.jsx', import.meta.url), 'utf8');

test('Owner Hub exposes a recoverable error when return confirmation fails', () => {
  assert.match(source, /const \[actionError, setActionError\] = useState\(''\);/);
  assert.match(source, /setActionError\(e\?\.message \|\| l\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('Owner Hub retry reuses the failed rental id after processing ends', () => {
  assert.match(source, /const \[actionErrorRentalId, setActionErrorRentalId\] = useState\(null\);/);
  assert.match(source, /setActionErrorRentalId\(rentalId\);/);
  assert.match(source, /const rental = pendingRequests\.find\(r => r\.id === actionErrorRentalId\);/);
  assert.match(source, /if \(rental\) handleConfirmReturn\(rental\.id\);/);
  assert.match(source, /setProcessingRentalId\(null\);/);
});
