import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ListItemPage.jsx', 'utf8');

assert.match(source, /isContactLoading/, 'list item must expose contact loading state');
assert.match(source, /role="status" aria-live="polite"/, 'list item contact loading must be accessible');
assert.match(source, /aria-busy="true"/, 'list item contact loading must expose busy semantics');
assert.match(source, /role="alert" aria-live="assertive"/, 'list item errors must be exposed as live alerts');
assert.match(source, /setContactRetryNonce\(v => v \+ 1\)/, 'list item contact recovery must retry the authoritative contact request');
assert.match(source, /fetchListingContact\(itemToEdit\.id\)/, 'list item edit contact details must use the real contact service');
assert.match(source, /createItemListing\(/, 'list item creation must use the real listing flow');
assert.match(source, /updateItem\(itemToEdit\.id/, 'list item editing must use the real listing flow');

console.log('List item state and authority checks passed.');
