import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

test('profile reputation loading exposes a visible error and real retry action', () => {
  assert.match(source, /const \[reviewLoadError, setReviewLoadError\] = useState\(''\);/);
  assert.match(source, /setReviewLoadError\(err\?\.message \|\| l\(/);
  assert.match(source, /role="alert"/);
  assert.match(source, /setReviewRetryNonce\(v => v \+ 1\)/);
  assert.match(source, /l\('تلاش مجدد', 'Try again'/);
});

test('profile reputation retry reuses the same server review fetch path', () => {
  assert.match(source, /fetchUserReviews\(currentUser\.username\)/);
  assert.match(source, /\[currentUser\?\.username, fetchUserReviews, reviewRetryNonce\]/);
  assert.doesNotMatch(source, /fetchUserReviews\(currentUser\.username\).*catch\(\(\) => \{\}\)/s);
});

test('profile exposes explicit loading states for profile and reputation data', () => {
  assert.match(source, /const \[profileLoading, setProfileLoading\] = useState\(true\);/);
  assert.match(source, /const \[reviewLoading, setReviewLoading\] = useState\(false\);/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /Loading reputation|بارگذاری اعتبار/);
});

test('profile exposes recovery for authoritative profile loading failure', () => {
  assert.match(source, /profileLoadError/);
  assert.match(source, /window\.location\.reload\(\)/);
  assert.match(source, /Unable to load your profile from the server/);
});
