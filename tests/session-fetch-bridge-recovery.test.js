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

test('session fetch bridge only invalidates an active session from the authoritative auth check', () => {
  assert.match(source, /const sessionWasActive = Boolean\(isSessionActive\(\)\);/);
  assert.match(source, /const isSessionCheck = url\.includes\('\/api\/auth\/me'\);/);
  assert.match(
    source,
    /if \(res\.status === 401 && isSessionCheck && !isPiLogin && sessionWasActive && typeof onSessionInvalid === 'function'\) onSessionInvalid\(\);/
  );
  assert.match(source, /installSessionFetchBridge\(handleSessionInvalid, \(\) => Boolean\(currentUserRef\.current\?\.uid\)\)/);
});


test('Pi session intent enables re-authentication after a missing server cookie without storing the session token', async () => {
  const source = await (await fetch('file://' + process.cwd() + '/src/context/PiAuthContext.jsx')).text().catch(() => '');
  // Source-level regression guard: the browser may lose the HttpOnly cookie across an app restart,
  // but the client must retain only a non-sensitive intent flag and recover through Pi.authenticate().
  assert.ok(source.includes("rentora_pi_session_intent_v1"), 'A non-sensitive session intent flag must exist');
  assert.ok(source.includes('hasPiSessionIntent()'), 'Initial restore must check session intent');
  assert.ok(source.includes('await piService.authenticate()'), 'Missing server session must recover through Pi authentication');
  assert.ok(!source.includes('localStorage.setItem(\'rentora_pi_session_token'), 'Session tokens must not be stored in localStorage');
});
