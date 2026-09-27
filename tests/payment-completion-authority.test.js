import fs from 'fs';
import assert from 'assert';

const worker = fs.readFileSync('_worker.js', 'utf8');

const start = worker.indexOf("const completion = await completionResponse.json()");
assert.ok(start >= 0, 'payment completion handler must parse Pi completion response');

const block = worker.slice(start, start + 900);
assert.ok(
  block.includes("if (!completionResponse.ok) {"),
  'a failed Pi completion request must stop before D1 settlement'
);
assert.ok(
  block.includes("return errorResponse('Pi payment completion failed'"),
  'failed Pi completion must return an error'
);

console.log('Pi payment completion authority checks passed.');
