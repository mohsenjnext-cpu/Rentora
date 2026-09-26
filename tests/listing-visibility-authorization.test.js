import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

function getRouteBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `route should exist: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `route boundary should exist: ${endMarker}`);
  return source.slice(start, end);
}

test('listing collection visibility is server-authoritative for guest, user, and admin scopes', () => {
  const block = getRouteBlock(
    "if (method === 'GET' && path === '/api/listings')",
    "if (method === 'GET' && path.startsWith('/api/listings/')"
  );

  assert.match(block, /let auth = null/);
  assert.match(block, /if \(authHeader\.startsWith\('Bearer '\)\)/);
  assert.match(block, /auth = await requireUser\(request, env\)/);

  const adminBranch = block.slice(block.indexOf('if (isAdminUser)'), block.indexOf('} else if (user)'));
  assert.match(adminBranch, /l\.status != 'deleted'/);

  const userBranch = block.slice(block.indexOf('} else if (user)'), block.indexOf('} else {'));
  assert.match(userBranch, /l\.status = 'active' OR l\.owner_user_id = \?1/);
  assert.match(userBranch, /l\.status != 'deleted'/);
  assert.match(userBranch, /\.bind\(user\.id\)/);

  const guestBranch = block.slice(block.indexOf('} else {'));
  assert.match(guestBranch, /l\.status = 'active'/);
  assert.doesNotMatch(guestBranch, /owner_user_id = \?1/);
});

test('single listing visibility denies non-active listings to unrelated authenticated users', () => {
  const block = getRouteBlock(
    "if (method === 'GET' && path.startsWith('/api/listings/')",
    "if (method === 'POST' && /^\\/api\\/admin\\/reconciliation\\/[^/]+\\/retry\$/.test(path))"
  );

  assert.match(block, /WHERE l\.id = \?1 AND l\.status != 'deleted'/);
  assert.match(block, /const isOwner = user && \(row\.owner_user_id === user\.id\)/);
  assert.match(block, /if \(row\.status !== 'active' && !isOwner && !isAdminUser\)/);
  assert.match(block, /'Listing is not publicly available'/);
  assert.match(block, /errorResponse\('Listing is not publicly available', 403/);
});
