import fs from 'fs';
import assert from 'assert';

const discover = fs.readFileSync('src/pages/DiscoverPage.jsx', 'utf8');
const profile = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

assert(discover.includes('const priceCap = useMemo'), 'Discover should derive its price filter cap from listing data');
assert(discover.includes('useState(null)'), 'Discover price filter should start without an arbitrary limit');
assert(discover.includes('max={priceCap}'), 'Discover price slider should use the derived price cap');
assert(discover.includes('maxPrice === null'), 'Discover should expose the no-limit price state');
assert(!discover.includes('useState(100)'), 'Discover must not hard-code a 100 Pi default cap');
assert(!profile.includes('api.dicebear.com'), 'Profile should not depend on external avatar presets');
assert(!profile.includes('AVATAR_PRESETS'), 'Profile should not contain external avatar preset state');
console.log('UI regression checks passed.');
