import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const gateway = fs.readFileSync(new URL('../worker-gateway2.js', import.meta.url), 'utf8');
const adminPage = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.jsx', import.meta.url), 'utf8');

test('platform fee policy is bounded to 1%-5% and persisted server-side', () => {
  assert.match(worker, /PLATFORM_FEE_MIN_RATE = 0\.01/);
  assert.match(worker, /PLATFORM_FEE_MAX_RATE = 0\.05/);
  assert.match(worker, /PLATFORM_FEE_CONFIG_KEY = 'config:platform_fee_rate'/);
  assert.match(worker, /await env\?\.RENTORA_KV\?\.get\(PLATFORM_FEE_CONFIG_KEY\)/);
  assert.match(worker, /await getPlatformFeeRate\(env\)/);
});

test('admin fee endpoint validates 1%-5% and writes the authoritative rate to KV', () => {
  assert.match(gateway, /path === '\/api\/admin\/platform-fee'/);
  assert.match(gateway, /requestedPercent < 1 \|\| requestedPercent > 5/);
  assert.match(gateway, /env\.RENTORA_KV\.put\('config:platform_fee_rate'/);
  assert.match(gateway, /PLATFORM_FEE_RATE/);
});

test('admin UI exposes the bounded platform fee setting', () => {
  assert.match(adminPage, /min="1" max="5"/);
  assert.match(adminPage, /\/api\/admin\/platform-fee/);
  assert.match(adminPage, /server.*محاسبه|محاسبه.*سرور/);
});
