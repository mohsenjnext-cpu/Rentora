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

test('rental contact access is restricted to rental participants and eligible paid renters', () => {
  const block = getRouteBlock(
    "if (method === 'GET' && path.startsWith('/api/rentals/') && path.endsWith('/contact'))",
    "if (method === 'GET' && path.startsWith('/api/listings/') && path.endsWith('/contact'))"
  );

  assert.match(block, /const \{ user \} = await requireUser\(request, env\)/);
  assert.match(block, /const isRenter = \(row\.renter_user_id === user\.id\)/);
  assert.match(block, /const isOwner = \(row\.owner_user_id === user\.id\)/);
  assert.match(block, /if \(!isRenter && !isOwner && !isAdminUser\)/);
  assert.match(block, /errorResponse\('Access denied to rental contact details', 403/);
  assert.match(block, /row\.payment_status === 'completed'/);
  assert.match(block, /\['confirmed', 'active', 'completed'\]\.includes\(row\.rental_status\)/);
  assert.match(block, /Contact information is locked until rental payment is confirmed/);
});

test('listing contact access is restricted to its owner or verified admin', () => {
  const block = getRouteBlock(
    "if (method === 'GET' && path.startsWith('/api/listings/') && path.endsWith('/contact'))",
    "// =========================================================================\n      // SECURE MARKETPLACE CONVERSATIONS"
  );

  assert.match(block, /const \{ user \} = await requireUser\(request, env\)/);
  assert.match(block, /const isOwner = \(row\.owner_user_id === user\.id\)/);
  assert.match(block, /const isAdminUser = isAdmin\(user\.pi_uid, env\) && user\.role === 'admin'/);
  assert.match(block, /if \(!isOwner && !isAdminUser\)/);
  assert.match(block, /errorResponse\('Access denied to listing contact details', 403/);
});

test('conversation read and message access requires participant membership', () => {
  const readBlock = getRouteBlock(
    "if (method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/read'))",
    "if (method === 'POST' && path === '/api/conversations')"
  );
  const messageBlock = getRouteBlock(
    "if (method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/messages'))",
    "if (method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/archive'))"
  );

  assert.match(readBlock, /conv\.owner_user_id !== user\.id && conv\.renter_user_id !== user\.id/);
  assert.match(readBlock, /errorResponse\('Access denied to conversation', 403/);
  assert.match(messageBlock, /conv\.owner_user_id === user\.id \|\| conv\.renter_user_id === user\.id/);
  assert.match(messageBlock, /if \(!isParticipant && !isAdminUser\)/);
  assert.match(messageBlock, /errorResponse\('Access denied to send message in this conversation', 403/);
  assert.match(messageBlock, /detectBypassAttempt\(rawText\)/);
  assert.match(messageBlock, /code: 'CONTACT_INFO_BLOCKED'/);
});

test('review status and submission require rental participants and completed verified rentals', () => {
  const statusBlock = getRouteBlock(
    "if (method === 'GET' && path.startsWith('/api/rentals/') && path.endsWith('/review-status'))",
    "if (method === 'POST' && path.startsWith('/api/rentals/') && path.endsWith('/reviews'))"
  );
  const submitBlock = getRouteBlock(
    "if (method === 'POST' && path.startsWith('/api/rentals/') && path.endsWith('/reviews'))",
    "if (method === 'GET' && path.startsWith('/api/users/') && !path.includes('/reviews') && !path.includes('/status'))"
  );

  assert.match(statusBlock, /const isRenter = \(rental\.renter_user_id === user\.id\)/);
  assert.match(statusBlock, /const isOwner = \(rental\.owner_user_id === user\.id\)/);
  assert.match(statusBlock, /if \(!isRenter && !isOwner && !isAdminUser\)/);
  assert.match(statusBlock, /errorResponse\('Access denied to rental review status', 403/);
  assert.match(statusBlock, /const isCompleted = \(rental\.status === 'completed'\)/);
  assert.match(statusBlock, /const isPaid = \(rental\.payment_status === 'completed'\)/);
  assert.match(statusBlock, /const isEligible = isCompleted && isPaid/);

  assert.match(submitBlock, /if \(!isRenter && !isOwner\)/);
  assert.match(submitBlock, /Only participants of this rental are permitted to leave a review/);
  assert.match(submitBlock, /rental\.status !== 'completed' \|\| rental\.payment_status !== 'completed'/);
  assert.match(submitBlock, /Review is only permitted after rental is completed and payment is verified/);
  assert.match(submitBlock, /SELECT id FROM reviews/);
  assert.match(submitBlock, /Duplicate review: you have already submitted a review for this rental/);
});
