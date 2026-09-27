import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ItemDetailPage.jsx', 'utf8');

assert.match(source, /role="status" aria-live="polite"/, 'item detail must expose a loading status');
assert.match(source, /role="alert" aria-live="assertive"/, 'item detail load failure must be announced as an alert');
assert.match(source, /onClick=\{\(\) => setDetailRetryNonce\(v => v \+ 1\)\}/, 'item detail must expose a real listing retry action');
assert.match(source, /fetchListingById\(itemId\)/, 'item detail must load the listing from the authoritative API');
assert.match(source, /fetchListingReviews\(detailItem\.id\)/, 'item detail reviews must load from the authoritative API');
assert.match(source, /onClick=\{\(\) => setReviewRetryNonce\(v => v \+ 1\)\}/, 'item detail reviews must expose a retry action');

console.log('Item detail recovery checks passed.');
