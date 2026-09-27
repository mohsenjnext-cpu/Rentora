import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ActivityPage.jsx', 'utf8');

assert.match(source, /isRefreshing = false,\s*refreshApp/, 'activity must use the real app refresh path');
assert.match(source, /role="status" aria-live="polite"/, 'activity must expose a loading status');
assert.match(source, /aria-busy="true"/, 'activity loading state must expose busy semantics');
assert.match(source, /role="alert" aria-live="assertive"/, 'activity must expose recoverable page errors');
assert.match(source, /onClick=\{refreshActivity\}/, 'activity retry must refresh authoritative account data');
assert.match(source, /const result = await refreshApp\?\.\(\)/, 'activity refresh must use the real app sync path');
assert.match(source, /fetchRentalContact/, 'activity must retain real secure contact loading');
assert.match(source, /onClick=\{\(\) => selectedContactRental && handleOpenContactModal\(selectedContactRental\)\}/, 'contact recovery must remain available');

console.log('Activity state and authority checks passed.');
