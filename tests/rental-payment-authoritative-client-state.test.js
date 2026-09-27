import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/context/RentoraContext.jsx', 'utf8');
const start = source.indexOf('const executePiPaymentForRental');
assert.ok(start >= 0, 'payment execution function must exist');
const block = source.slice(start, start + 2600);

const syncIndex = block.indexOf('const authoritativeRental = await cloudSyncService.broadcastNewRental(confirmedRental);');
const stateIndex = block.indexOf('setRentals(prev =>');
assert.ok(syncIndex >= 0, 'payment completion must sync the rental through the server');
assert.ok(stateIndex > syncIndex, 'client state must be updated only after authoritative server rental is returned');
assert.ok(!block.includes('setRentals(prev => {\n      const updated = [confirmedRental'),
  'client must not persist the pre-sync rental as authoritative state');
assert.ok(block.includes('authoritativeRental.id'),
  'client cache must use the server-returned rental identity');

console.log('Authoritative post-payment rental state checks passed.');
