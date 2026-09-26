import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/PublicProfilePage.jsx', 'utf8');

assert.match(source, /profileLoadError/);
assert.match(source, /reviewsLoadError/);
assert.match(source, /retryNonce/);
assert.match(source, /fetchPublicUserProfile\(targetUsername\)/);
assert.match(source, /fetchUserReviews\(targetUsername\)/);
assert.match(source, /setRetryNonce\(v => v \+ 1\)/);
assert.match(source, /role="alert"/);
assert.match(source, /تلاش مجدد/);
assert.match(source, /Try again/);
assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);

console.log('public profile recovery checks passed');
