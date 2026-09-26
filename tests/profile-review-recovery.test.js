import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

test('profile reputation loading exposes a visible error and real retry action', () => {
  assert.match(source, /const \[reviewLoadError, setReviewLoadError\] = useState\(''\);/);
  assert.match(source, /setReviewLoadError\(err\?\.message \|\| l\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{\(\) => setReviewRetryNonce\(v => v \+ 1\)\}/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('profile reputation retry reuses the same server review fetch path', () => {
  assert.match(source, /fetchUserReviews\(currentUser\.username\)/);
  assert.match(source, /\[currentUser\?\.username, fetchUserReviews, reviewRetryNonce\]/);
  assert.doesNotMatch(source, /fetchUserReviews\(currentUser\.username\).*catch\(\(\) => \{\}\)/s);
});