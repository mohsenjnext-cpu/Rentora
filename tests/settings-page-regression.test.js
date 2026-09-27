import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');

assert.match(source, /changeLanguage\(lng\.code\)/, 'settings language controls must use the real language context');
assert.match(source, /aria-pressed=\{isSelected\}/, 'settings language controls must expose selected state');
assert.match(source, /onClick=\{toggleTheme\}/, 'settings theme control must use the real theme context');
assert.match(source, /aria-pressed=\{theme === 'dark'\}/, 'settings theme control must expose pressed state');
assert.match(source, /setIsWalletModalOpen\(true\)/, 'settings Pi Ledger must open the real wallet ledger');
assert.match(source, /onOpenSecurity/, 'settings must retain the real security center entry');
assert.match(source, /onOpenHelp\('guide'\)/, 'settings must retain the real help center entry');
assert.match(source, /onOpenSupport/, 'settings must retain the real support entry');
assert.match(source, /logout\(\)/, 'settings logout must use the real authentication flow');
assert.match(source, /setAuthModalOpen\(true\)/, 'settings login must use the real authentication modal');
assert.doesNotMatch(source, /INITIAL_(ITEMS|RENTALS)|mock|fake|sample/i, 'settings must not introduce mock or sample data');

console.log('Settings accessibility and real-action checks passed.');
