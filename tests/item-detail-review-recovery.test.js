import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/pages/ItemDetailPage.jsx', import.meta.url), 'utf8');

test('item detail review loading exposes a visible retry action', () => {
  assert.match(source, /const \[reviewRetryNonce, setReviewRetryNonce\] = useState\(0\);/);
  assert.match(source, /setReviewsError\(l\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{\(\) => setReviewRetryNonce\(v => v \+ 1\)\}/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('item detail review retry reuses the authoritative review fetch path', () => {
  assert.match(source, /fetchListingReviews\(detailItem\.id\)/);
  assert.match(source, /\[detailItem\?\.id, fetchListingReviews, reviewRetryNonce\]/);
  assert.doesNotMatch(source, /fetchListingReviews\(detailItem\.id\).*catch\(\(\) => \{\}\)/s);
});
