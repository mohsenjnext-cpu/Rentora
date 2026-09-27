import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ListItemPage.jsx', 'utf8');

assert.match(
  source,
  /const finalImages = images\.length > 0 \? images : \[\];/,
  'editing a listing without images must not dereference an empty preset image collection'
);
assert.doesNotMatch(
  source,
  /presetImages\.tools\[0\]/,
  'listing edit must not fall back to an undefined preset image'
);

console.log('Listing edit empty-image recovery checks passed.');
