import fs from 'fs';
import assert from 'assert';

const worker = fs.readFileSync('_worker.js', 'utf8');
const start = worker.indexOf("path === '/api/sync/user'");
assert.ok(start >= 0, 'user sync route must exist');
const block = worker.slice(start, start + 4200);

assert.ok(
  block.includes('const editableMeta = Object.fromEntries'),
  'user sync must explicitly whitelist editable metadata'
);
for (const forbidden of ['body.role', 'body.status', 'body.kycStatus', 'body.piUid', 'body.username']) {
  assert.ok(!block.includes(forbidden), `user sync must not consume client authority field: ${forbidden}`);
}
assert.ok(
  block.includes('UPDATE users SET display_name=?1,avatar_url=?2,metadata=?3'),
  'user sync must persist only the selected profile presentation columns plus editable metadata'
);
assert.ok(
  block.includes('Identity, role, status, KYC, Pi identifiers, and account state remain server-authoritative.'),
  'route must document the authority boundary'
);

console.log('User sync authority regression checks passed.');
