import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/services/cloudSyncService.js', 'utf8');

assert.match(source, /getCachedItems\(\) \{\s*return \[\];/, 'marketplace cache must remain memory-free');
assert.match(source, /getCachedUsers\(\) \{\s*return \[\];/, 'user cache must remain memory-free');
assert.doesNotMatch(source, /localStorage\.setItem\(STORAGE_(ITEMS|USERS)_KEY/, 'marketplace and user records must not be persisted to localStorage');
assert.match(source, /localStorage\.removeItem\('rentora_live_v1_items'\)/, 'legacy marketplace cache must be cleared');
assert.match(source, /localStorage\.removeItem\('rentora_live_v1_users_dir'\)/, 'legacy user cache must be cleared');
assert.match(source, /BroadcastChannel is a transport only/, 'cross-tab listing events must not become an authority boundary');
assert.match(source, /fetchSharedData\(true\)/, 'cross-tab rental updates must re-fetch authoritative server state');

console.log('Global client cache authority checks passed.');
