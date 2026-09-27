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

assert.match(source, /const handleBrowserBack = \(fallbackTab = 'discover'\)/, 'in-app back actions must use the shared browser-history recovery path');
assert.match(source, /onBack=\{\(\) => handleBrowserBack\(previousTab \|\| 'discover'\)\}/, 'item and public profile back actions must unwind browser history');
assert.match(source, /onCancelEdit=\{\(\) => \{ setEditingItem\(null\); handleBrowserBack\(previousTab \|\| 'owner-hub'\); \}\}/, 'cancel edit must unwind browser history instead of leaving a stale history entry');

assert.match(source, /onNavigateToActivity=\{\(\) => handleNavigate\('activity'\)\}/, 'item detail activity navigation must create a browser history entry');
assert.match(source, /onNavigateToOwnerHub=\{\(\) => handleNavigate\('owner-hub'\)\}/, 'item detail owner hub navigation must create a browser history entry');
assert.match(source, /if \(currentUser && normalizeUsername\(currentUser\.username\) === normalizeUsername\(username\)\) \{\s*handleNavigate\('profile'\);/, 'self-profile routing must preserve browser history');

assert.match(source, /onNavigate=\{\(page\) => \{ setEditingItem\(null\); handleNavigate\(page\); \}\}/, 'listing page navigation must preserve browser history');
assert.match(source, /onBookingSuccess=\{\(\) => \{ setIsDirectBookingOpen\(false\); setDirectBookingItem\(null\); handleNavigate\('activity'\); \}\}/, 'successful booking navigation must preserve browser history');

assert.match(source, /onItemCreated=\{\(newItem\) => \{ setEditingItem\(null\); handleSelectItem\(newItem\); \}\}/, 'listing creation must preserve browser history when opening the new detail');
assert.match(source, /onItemUpdated=\{\(updatedItem\) => \{ setEditingItem\(null\); handleSelectItem\(updatedItem\); \}\}/, 'listing update must preserve browser history when opening the updated detail');
