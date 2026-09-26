import fs from 'fs';

const source = fs.readFileSync('src/components/ItemCard.jsx', 'utf8');

if (!source.includes('Package')) throw new Error('ItemCard must use the local Package placeholder icon');
if (!source.includes('import {')) throw new Error('ItemCard icon import is missing');
if (source.includes('images.unsplash.com')) throw new Error('External Unsplash fallback must remain removed');

console.log('item-card placeholder import regression: PASS');
