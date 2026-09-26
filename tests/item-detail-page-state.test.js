import fs from 'fs';
import assert from 'assert';

const page = fs.readFileSync('src/pages/ItemDetailPage.jsx', 'utf8');
const service = fs.readFileSync('src/services/cloudSyncService.js', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');

assert(page.includes('detailLoading'), 'Item Detail should expose a full-page loading state');
assert(page.includes('detailError'), 'Item Detail should expose a full-page error state');
assert(page.includes('fetchListingById(itemId)'), 'Item Detail should load a missing listing from the authoritative API');
assert(page.includes('role="status"'), 'Item Detail loading state should be announced accessibly');
assert(page.includes('Listing unavailable'), 'Item Detail should provide a localized unavailable/error state');
assert(service.includes('GET') && service.includes('/api/listings/'), 'Listing detail loader should use the authoritative listing endpoint');
assert(service.includes('err.status = res.status'), 'Listing load errors should preserve HTTP status');
assert(app.includes('itemId={selectedItemId}'), 'App should preserve the selected listing ID for detail loading');

console.log('item-detail-page-state: ok');
