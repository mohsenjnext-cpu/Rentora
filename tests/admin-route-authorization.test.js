import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

const requiredGuards = [
  /method === 'GET' && path === '\/api\/admin\/console'[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'GET' && path === '\/api\/admin\/overview'[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path === '\/api\/admin\/cleanup'[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path === '\/api\/admin\/payout'[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'GET' && path === '\/api\/admin\/users'[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path\.startsWith\('\/api\/admin\/users\/'\)[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path\.startsWith\('\/api\/admin\/reports\/'\)[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path\.startsWith\('\/api\/admin\/listings\/'\)[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path\.startsWith\('\/api\/admin\/reconciliation\/'\)[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path\.startsWith\('\/api\/reports\/'\)[\s\S]*?requireAdmin\(request, env\)/,
  /method === 'POST' && path === '\/api\/sync\/purge'[\s\S]*?requireAdmin\(request, env\)/
];

test('all privileged admin routes require server-side admin authorization', () => {
  for (const routePattern of requiredGuards) {
    assert.match(source, routePattern);
  }
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
