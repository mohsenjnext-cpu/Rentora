import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ActivityPage.jsx', 'utf8');

assert.match(
  source,
  /const \[handoverError, setHandoverError\] = useState\(''\);/
);
assert.match(
  source,
  /const \[handoverErrorRentalId, setHandoverErrorRentalId\] = useState\(null\);/
);

const handlerStart = source.indexOf('const handleConfirmHandover = async');
const handlerEnd = source.indexOf('\n  };', handlerStart) + 5;
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'handover handler must exist');
const handler = source.slice(handlerStart, handlerEnd);

assert.match(handler, /setHandoverError\(''\)/);
assert.match(handler, /setHandoverErrorRentalId\(rentalId\)/);
assert.match(handler, /catch \(e\)/);
assert.match(handler, /setHandoverError\(e\?\.message \|\| l\(/);
assert.doesNotMatch(handler, /console\.warn\(e\)/);
assert.match(handler, /setProcessingId\(null\)/);

const recoveryStart = source.indexOf('{handoverError && (');
assert.ok(recoveryStart >= 0, 'handover error recovery UI must be rendered');
const recoveryEnd = source.indexOf('{/* Unified Activity Feed */}', recoveryStart);
const recovery = source.slice(recoveryStart, recoveryEnd);

assert.match(recovery, /role="alert"/);
assert.match(recovery, /handoverError/);
assert.match(recovery, /handoverErrorRentalId && handleConfirmHandover\(handoverErrorRentalId\)/);
assert.match(recovery, /disabled=\{processingId !== null\}/);
assert.match(recovery, /تلاش مجدد/);
assert.match(recovery, /Try again/);

const buttonIndex = source.indexOf("onClick={() => handleConfirmHandover(rental.id)}");
assert.ok(buttonIndex >= 0, 'confirmed rental must retain the handover action');
