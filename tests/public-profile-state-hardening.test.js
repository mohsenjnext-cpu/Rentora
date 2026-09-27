import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/PublicProfilePage.jsx', 'utf8');

assert.match(source, /isProfileLoading/, 'public profile must expose profile loading state');
assert.match(source, /isReviewsLoading/, 'public profile must expose reviews loading state');
assert.match(source, /role="status" aria-live="polite"/, 'public profile loading must be accessible');
assert.match(source, /aria-busy="true"/, 'public profile loading must expose busy semantics');
assert.match(source, /role="alert"/, 'public profile errors must be exposed as alerts');
assert.match(source, /setRetryNonce\(v => v \+ 1\)/, 'public profile recovery must retry authoritative requests');
assert.match(source, /fetchPublicUserProfile\(targetUsername\)/, 'public profile must use the real public profile service');
assert.match(source, /fetchUserReviews\(targetUsername\)/, 'public profile must use the real reviews service');
assert.match(source, /status !== 'active'/, 'public profile must render only active listings');

console.log('Public profile state and authority checks passed.');
