import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

 test('platform fee configuration is protected by the admin identity check', () => {
  const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
  const routeStart = gateway.indexOf("async function adminRoute(request, env, path)");
  const feeRoute = gateway.indexOf("if (path === '/api/admin/platform-fee')", routeStart);
  const adminGuard = gateway.indexOf("if (!(user.role === 'admin' && adminAllowed(user.pi_uid, env)))", routeStart);
  assert.ok(routeStart >= 0, 'adminRoute must exist');
  assert.ok(adminGuard > routeStart && adminGuard < feeRoute, 'platform fee route must be behind the admin guard');
});
