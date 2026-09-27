import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/DiscoverPage.jsx', 'utf8');

assert.match(source, /useEffect/,'discover must react to authoritative listing refresh state');
assert.match(source, /isRefreshing = false, refreshApp/,'discover must use the real app refresh path');
assert.match(source, /aria-busy="true"/,'discover must expose a loading state');
assert.match(source, /Retry/,'discover must expose a recovery action');
assert.match(source, /refreshApp\?\.\(\)/,'discover retry must refresh authoritative marketplace data');
assert.match(source, /status && item\.status !== 'active'/,'discover must render only active listings');

console.log('Discover state and authority checks passed.');
