import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

const routeGuards = [
  { name: 'admin console', route: /method === 'GET' && path === '\/api\/admin\/console'[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin overview', route: /method === 'GET' && path === '\/api\/admin\/overview'[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin cleanup', route: /method === 'POST' && path === '\/api\/admin\/cleanup'[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin payout', route: /method === 'POST' && path === '\/api\/admin\/payout'[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin users list', route: /method === 'GET' && path === '\/api\/admin\/users'[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin user status', route: /method === 'POST' && path\.startsWith\('\/api\/admin\/users\/'\) && path\.endsWith\('\/status'\)[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin user kyc', route: /method === 'POST' && path\.startsWith\('\/api\/admin\/users\/'\) && path\.endsWith\('\/kyc'\)[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin report status', route: /method === 'POST' && path\.startsWith\('\/api\/admin\/reports\/'\) && path\.endsWith\('\/status'\)[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'admin listing status', route: /method === 'POST' && path\.startsWith\('\/api\/admin\/listings\/'\) && path\.endsWith\('\/status'\)[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'report resolve', route: /method === 'POST' && path\.startsWith\('\/api\/reports\/'\) && path\.endsWith\('\/resolve'\)[\s\S]*?requireAdmin\(request, env\)/ },
  { name: 'database purge', route: /method === 'POST' && path === '\/api\/sync\/purge'[\s\S]*?requireAdmin\(request, env\)/ }
];

test('all privileged admin routes are protected by server-side admin authorization', () => {
  for (const { name, route } of routeGuards) {
    assert.match(source, route, `route should be present and guarded: ${name}`);
  }

  const reconciliationStart = source.indexOf("if (method === 'POST' && /^\\/api\\/admin\\/reconciliation\\/[^/]+\\/retry$/.test(path))");
  assert.notEqual(reconciliationStart, -1, 'reconciliation retry route should exist');
  const reconciliationBlock = source.slice(reconciliationStart, reconciliationStart + 1200);
  assert.match(reconciliationBlock, /requireAdmin\\(request, env\\)/, 'reconciliation retry route should be guarded');
});

test('requireAdmin requires active authentication plus allowlisted admin role', () => {
  const start = source.indexOf('async function requireAdmin(');
  const end = source.indexOf('\n\n', start);
  const block = source.slice(start, end === -1 ? start + 1000 : end);

  assert.match(block, /await requireUser\(request, env\)/);
  assert.match(block, /isAdmin\(auth\.user\.pi_uid, env\)/);
  assert.match(block, /auth\.user\.role !== 'admin'/);
  assert.match(block, /status: 403/);
});
