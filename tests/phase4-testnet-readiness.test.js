import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Phase 4: Pi Testnet Environment Configuration', async (t) => {
  await t.test('Pi SDK initialization in piService is strictly configured for Pi Testnet (sandbox: false)', () => {
    const piServicePath = path.join(rootDir, 'src', 'services', 'piService.js');
    const piServiceContent = fs.readFileSync(piServicePath, 'utf8');
    assert.match(piServiceContent, /sandbox:\s*false/, 'piService must have sandbox: false');
    assert.doesNotMatch(piServiceContent, /sandbox:\s*true/, 'piService must NOT have sandbox: true');
  });

  await t.test('Pi SDK script tag is included in index.html', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.match(indexContent, /https:\/\/sdk\.minepi\.com\/pi-sdk\.js/, 'index.html must load the official Pi SDK');
  });
});

test('Phase 4: onIncompletePaymentFound Handling and Server Recovery', async (t) => {
  await t.test('Frontend piService implements onIncompletePaymentFound and delegates to server /api/payments/incomplete', () => {
    const piServicePath = path.join(rootDir, 'src', 'services', 'piService.js');
    const piServiceContent = fs.readFileSync(piServicePath, 'utf8');
    assert.match(piServiceContent, /onIncompletePaymentFound/, 'piService must implement onIncompletePaymentFound');
    assert.match(piServiceContent, /\/api\/payments\/incomplete/, 'piService must call /api/payments/incomplete');
  });

  await t.test('Cloudflare Worker gateway handles incomplete payment resolution via Pi API', () => {
    const gatewayContent = fs.readFileSync(path.join(rootDir, 'worker-gateway2.js'), 'utf8');
    const workerContent = fs.readFileSync(path.join(rootDir, '_worker.js'), 'utf8');
    const legacyServerContent = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    const legacyBackendContent = fs.readFileSync(path.join(rootDir, 'backend', 'server.js'), 'utf8');

    assert.match(gatewayContent, /handleIncompletePayment/, 'worker-gateway2.js must implement handleIncompletePayment');
    assert.match(gatewayContent, /\/payments\/.*\/complete/, 'worker-gateway2.js must call Pi complete when txid exists');
    assert.match(gatewayContent, /reconciliation_required/, 'worker-gateway2.js must use reconciliation_required when incomplete payout correlation is ambiguous');
    assert.match(workerContent, /\/api\/payments\/incomplete/, '_worker.js must route /api/payments/incomplete');

    assert.match(legacyServerContent, /Legacy Express runtime intentionally disabled/, 'server.js must remain fail-closed and disabled');
    assert.match(legacyBackendContent, /Legacy Express runtime intentionally disabled/, 'backend/server.js must remain fail-closed and disabled');
    assert.doesNotMatch(legacyServerContent, /app\.post\(['"]\/api\/payments\/incomplete/, 'server.js must not expose the legacy payment recovery API');
    assert.doesNotMatch(legacyBackendContent, /app\.post\(['"]\/api\/payments\/incomplete/, 'backend/server.js must not expose the legacy payment recovery API');
  });
});

test('Phase 4: Pi Native Ads Service Abstraction', async (t) => {
  await t.test('Pi Ads service abstraction module exists and exports expected methods', async () => {
    const adsServicePath = path.join(rootDir, 'src', 'services', 'piAdsService.js');
    assert.ok(fs.existsSync(adsServicePath), 'piAdsService.js must exist');
    const { piAdsService, PI_ADS_CONFIG } = await import('../src/services/piAdsService.js');
    assert.ok(piAdsService, 'piAdsService instance must be exported');
    assert.equal(typeof piAdsService.isAdReady, 'function', 'isAdReady must be a function');
    assert.equal(typeof piAdsService.requestAd, 'function', 'requestAd must be a function');
    assert.equal(typeof piAdsService.showAd, 'function', 'showAd must be a function');
    assert.equal(typeof piAdsService.hasAdsSdk, 'function', 'hasAdsSdk must be a function');
    assert.equal(PI_ADS_CONFIG.enabled, false, 'Pi Ads should be disabled by default until production activation');
  });

  await t.test('Pi Ads gracefully handles missing SDK in test environment', async () => {
    const { piAdsService } = await import('../src/services/piAdsService.js');
    const isReady = await piAdsService.isAdReady('rewarded');
    assert.equal(isReady, false, 'isAdReady should return false when SDK is absent or disabled');
    const requestRes = await piAdsService.requestAd('rewarded');
    assert.equal(requestRes, false, 'requestAd should return false when SDK is absent or disabled');
    const showRes = await piAdsService.showAd('rewarded');
    assert.equal(showRes.shown, false, 'showAd should not show when SDK is absent or disabled');
  });
});

test('Phase 4: Domain & App Studio Validation Key', async (t) => {
  const expectedKey = 'd8b5b506fc41746eb0aba3ff56bcb32ed03dd33bf0348a3af22893ba437b437544a2c160e3ba460b7986e1994fa19964a4beabd3ae98620da1f8b90dece4f7b8';

  await t.test('public/validation-key.txt exists and contains canonical verification hash', () => {
    const valKeyPath = path.join(rootDir, 'public', 'validation-key.txt');
    assert.ok(fs.existsSync(valKeyPath), 'public/validation-key.txt must exist');
    const content = fs.readFileSync(valKeyPath, 'utf8').trim();
    assert.equal(content, expectedKey, 'validation-key.txt content must match exact hash');
  });

  await t.test('Active Worker entrypoints serve validation-key.txt; disabled legacy servers stay fail-closed', () => {
    const gatewayContent = fs.readFileSync(path.join(rootDir, 'worker-gateway2.js'), 'utf8');
    const workerContent = fs.readFileSync(path.join(rootDir, '_worker.js'), 'utf8');
    const serverContent = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    const backendServerContent = fs.readFileSync(path.join(rootDir, 'backend', 'server.js'), 'utf8');

    assert.ok(gatewayContent.includes(expectedKey), 'worker-gateway2.js must serve canonical validation key');
    assert.ok(workerContent.includes(expectedKey), '_worker.js must serve canonical validation key');
    assert.match(serverContent, /Legacy Express runtime intentionally disabled/, 'server.js must remain disabled');
    assert.match(backendServerContent, /Legacy Express runtime intentionally disabled/, 'backend/server.js must remain disabled');
  });
});
