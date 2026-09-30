import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('gateway authentication reads the secure host-only session cookie', () => {
  for (const file of ['worker-gateway2.js', 'workers/worker-gateway2.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /cookies\[['"]__Host-rentora_session['"]\]/);
    assert.doesNotMatch(source, /cookies\.rentora_session/);
    assert.match(source, /Set-Cookie/);\n    assert.match(source, /SameSite=None/);\n    assert.match(source, /Partitioned/);\n    assert.match(source, /setCookie\.includes\('__Host-rentora_session='/);\n    assert.doesNotMatch(source, /data\.sessionToken/);
    assert.doesNotMatch(source, /Set-Cookie[^\n]*['"]rentora_session=/);
  }
});

test('Pi authentication persists cookies and only marks SDK auth after server verification', () => {
  const source = fs.readFileSync('src/services/piService.js', 'utf8');
  assert.match(source, /credentials:\s*['"]include['"]/);
  assert.match(source, /if \(!response\.ok \|\| !data\?\.user\?\.uid\)/);
  const serverCheck = source.indexOf("if (!response.ok || !data?.user?.uid)");
  const authenticated = source.indexOf("this.isSdkAuthenticated = true;", serverCheck);
  assert.ok(serverCheck >= 0 && authenticated > serverCheck);
});

test('Pi SDK initialization does not claim success after init throws', () => {
  const source = fs.readFileSync('src/services/piService.js', 'utf8');
  assert.ok(source.includes('this.isInitialized = false;'));
  assert.ok(source.includes('window.__PI_INITIALIZED__ = false;'));
  assert.ok(source.includes('return false;'));
});

test('gateway forwards the current host-only session cookie', () => {
  for (const file of ['worker-gateway2.js', 'workers/worker-gateway2.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes("parseCookies(request)['__Host-rentora_session']"));
    assert.doesNotMatch(source, /parseCookies\(request\)\.rentora_session/);
  }
});


test('gateway reuses the cookie-derived Authorization token for session lookup', () => {
  for (const file of ['worker-gateway2.js', 'workers/worker-gateway2.js']) {
    const source = fs.readFileSync(file, 'utf8');
    const cookieBlock = source.indexOf("if (cookieToken)");
    const authCheck = source.indexOf("if (!auth.startsWith('Bearer '))", cookieBlock);
    const authAssignment = source.indexOf("auth = headers.get('Authorization')", cookieBlock);
    assert.ok(cookieBlock >= 0 && authAssignment > cookieBlock && authAssignment < authCheck);
    assert.doesNotMatch(source.slice(cookieBlock, authCheck), /const auth = request\.headers\.get\('Authorization'\)/);
  }
});
