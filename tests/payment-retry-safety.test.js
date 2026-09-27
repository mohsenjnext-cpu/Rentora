import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/services/piService.js', 'utf8');

assert.match(source, /if \(errMsg\.includes\('scope'\) \|\| errMsg\.includes\('authenticate'\)\)/, 'Pi payment retry must only re-authenticate for SDK authentication or scope failures');
assert.doesNotMatch(source, /errMsg\.includes\('payment'\)/, 'Pi payment errors must not trigger a second native payment attempt');
assert.match(source, /await this\.approvePaymentOnServer\(paymentId, serverIntent\.id\)/, 'Pi approval must remain server-authoritative');
assert.match(source, /await this\.completePaymentOnServer\(paymentId, txid, serverIntent\.id\)/, 'Pi completion must remain server-authoritative');

console.log('Pi payment retry safety checks passed.');
