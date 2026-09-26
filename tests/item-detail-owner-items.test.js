import fs from 'fs';
import assert from 'assert';

const item = fs.readFileSync('src/pages/ItemDetailPage.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');

assert(item.includes('const ownerItems = (items || []).filter'), 'Item Detail should derive other active owner listings');
assert(item.includes("candidate.status === 'active'"), 'Owner listings should only surface active items');
assert(item.includes('onSelectItem?.(other)'), 'Other owner listings should open their item detail');
assert(item.includes('More from this owner'), 'Owner listings section should have accessible English copy');
assert(app.includes('onSelectItem={handleSelectItem} onBack='), 'App should wire Item Detail item selection');
