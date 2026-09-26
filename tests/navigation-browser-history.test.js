import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/App.jsx', 'utf8');

assert.match(source, /window\.history\.replaceState\(initialState/, 'navigation must seed browser history without a reload');
assert.match(source, /window\.history\.pushState\(nextState/, 'navigation must push recoverable browser history entries');
assert.match(source, /window\.addEventListener\('popstate', handlePopState\)/, 'navigation must listen for browser back and forward events');
assert.match(source, /setSelectedItemId\(state\.selectedItemId \|\| null\)/, 'back and forward must restore the selected item id');
assert.match(source, /setPublicProfileUsername\(state\.publicProfileUsername \|\| null\)/, 'back and forward must restore public profile context');
assert.match(source, /setDiscoverInitialCategory\(state\.discoverInitialCategory \|\| 'all'\)/, 'back and forward must restore discover category state');
assert.match(source, /setDiscoverInitialQuery\(state\.discoverInitialQuery \|\| ''\)/, 'back and forward must restore discover query state');
assert.match(source, /setIsDirectBookingOpen\(false\)/, 'history navigation must close stale direct booking state');
assert.doesNotMatch(source, /window\.location\.reload\(\)/, 'navigation recovery must not use a full page reload');

console.log('Browser navigation history recovery checks passed.');
