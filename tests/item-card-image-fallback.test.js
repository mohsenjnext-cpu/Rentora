import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/components/ItemCard.jsx', 'utf8');

assert.ok(source.includes('const imageUrl ='), 'ItemCard should derive an image URL');
assert.ok(source.includes('<Package className="w-10 h-10 stroke-[1.5]" />'), 'ItemCard should render a local placeholder when no image exists');
assert.ok(!source.includes('images.unsplash.com'), 'ItemCard must not use an external/mock image fallback');

console.log('ItemCard image fallback regression checks passed.');
