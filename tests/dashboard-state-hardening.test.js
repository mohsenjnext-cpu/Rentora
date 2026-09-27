import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/OwnerHubPage.jsx', 'utf8');

assert.match(source, /role="status" aria-live="polite"/, 'dashboard must expose a loading status');
assert.match(source, /role="alert" aria-live="assertive"/, 'dashboard load failure must be announced as an alert');
assert.match(source, /const result = await refreshApp\?\.\(\)/, 'dashboard must refresh authoritative account data');
assert.match(source, /Dashboard could not be loaded/, 'dashboard must expose a recoverable load error');
assert.match(source, /window\.location\.reload\(\)/, 'dashboard must expose a retry action');

console.log('Dashboard state hardening checks passed.');
