import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/context/PiAuthContext.jsx', import.meta.url), 'utf8');

test('session fetch bridge keeps API classification available to its error recovery path', () => {
  const fetchStart = source.indexOf('window.fetch = async (input, init = {}) => {');
  const tryStart = source.indexOf('    try {', fetchStart);
  const apiRequestIndex = source.indexOf('const isApiRequest =', fetchStart);
  const catchIndex = source.indexOf('    } catch (error) {', tryStart);

  assert.ok(fetchStart >= 0, 'session fetch bridge should wrap window.fetch');
  assert.ok(tryStart > fetchStart, 'bridge should protect the fetch operation');
  assert.ok(apiRequestIndex > fetchStart && apiRequestIndex < tryStart, 'API classification must be in fetch scope, before try');
  assert.ok(catchIndex > tryStart, 'bridge should retain an error recovery path');
  assert.ok(source.includes('if (isApiRequest) throw error;'), 'API failures must propagate without unsafe retry');
});

test('session fetch bridge still invalidates authenticated state on a non-login 401', () => {
  assert.match(
    source,
    /if \(res\.status === 401 && !isPiLogin && typeof onSessionInvalid === 'function'\) onSessionInvalid\(\);/
  );
});
