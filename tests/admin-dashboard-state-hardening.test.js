import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/AdminDashboardPage.jsx', 'utf8');

assert.match(source, /role="status" aria-live="polite"/, 'admin dashboard must expose a loading status');
assert.match(source, /role="alert" aria-live="assertive"/, 'admin dashboard must expose recoverable access/load errors');
assert.match(source, /onClick={load}/, 'admin dashboard must expose a retry/refresh action');
assert.match(source, /\/api\/admin\/console\?_t=/, 'admin dashboard must load authoritative console data');
assert.match(source, /\/api\/admin\/platform-fee/, 'admin dashboard must load the authoritative platform fee');

console.log('Admin dashboard state and authority checks passed.');
