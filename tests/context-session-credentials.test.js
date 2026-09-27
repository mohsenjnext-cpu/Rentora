import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/context/RentoraContext.jsx', 'utf8');

assert.ok(
  !/localStorage\.getItem\(['"]rentora_live_v1_session['"]\)/.test(source),
  'RentoraContext must not read the session token from localStorage'
);

for (const path of [
  '/api/sync/rental/status',
  '/api/rentals/',
  '/api/listings/'
]) {
  assert.ok(source.includes(path), `expected authenticated API path: ${path}`);
}

console.log('Rentora context session credential checks passed.');
