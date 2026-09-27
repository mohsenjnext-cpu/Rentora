import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/context/RentoraContext.jsx', 'utf8');

assert.ok(
  source.includes('}, [userIdentifier, usernameIdentifier]);'),
  'conversation refresh must only depend on identifiers that exist in RentoraContext'
);
assert.doesNotMatch(
  source,
  /getReadTimestamps/,
  'conversation refresh must not reference an undefined getReadTimestamps dependency'
);

console.log('Rentora context conversation refresh checks passed.');
