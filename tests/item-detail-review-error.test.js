import fs from 'fs';
import assert from 'assert';
const c=fs.readFileSync('src/pages/ItemDetailPage.jsx','utf8');
assert(c.includes('reviewsError'));
assert(c.includes('Unable to load reviews.'));
assert(c.includes('reviewsError ? ('));
console.log('Item detail review error regression checks passed.');
