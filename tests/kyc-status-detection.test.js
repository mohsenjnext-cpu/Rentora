import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function resolvePublicKycStatus(meta = {}, legacyColumn = null) {
  const admin = ['verified', 'unverified', 'unknown', 'pending'].includes(meta.adminKycStatus) ? meta.adminKycStatus : 'unknown';
  if (admin !== 'unknown') return admin;
  return legacyColumn === 'verified' ? 'verified' : (legacyColumn === 'unverified' ? 'unverified' : 'unknown');
}

test('KYC 1: Pi identity alone is not treated as KYC', () => {
  const piUser = { uid: 'uid_alice', username: 'alice' };
  assert.equal(resolvePublicKycStatus({ piUser }), 'unknown');
});

test('KYC 2: only a server-side Rentora verification record can produce verified', () => {
  assert.equal(resolvePublicKycStatus({ adminKycStatus: 'verified' }), 'verified');
  assert.equal(resolvePublicKycStatus({ adminKycStatus: 'unverified' }), 'unverified');
  assert.equal(resolvePublicKycStatus({ adminKycStatus: 'pending' }), 'pending');
});

test('KYC 3: an unverified server record cannot inherit another users status', () => {
  const alice = { adminKycStatus: 'verified' };
  const bob = { adminKycStatus: 'unverified' };
  assert.equal(resolvePublicKycStatus(alice), 'verified');
  assert.equal(resolvePublicKycStatus(bob), 'unverified');
});

test('KYC 4: legacy status is only a fallback when no Rentora review exists', () => {
  assert.equal(resolvePublicKycStatus({}, 'verified'), 'verified');
  assert.equal(resolvePublicKycStatus({ adminKycStatus: 'unverified' }, 'verified'), 'unverified');
});

test('KYC 5: profile UI uses explicit verification state instead of claiming Pi KYC from SDK identity', () => {
  const source = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');
  assert.match(source, /KycStatus/);
  assert.match(source, /رکورد احراز هویت ثبت‌شده در سرور Rentora/);
  assert.doesNotMatch(source, /KYC Verified/);
});
