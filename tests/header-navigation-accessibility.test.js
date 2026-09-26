import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/components/Header.jsx', 'utf8');

assert.match(source, /currentPage === 'notifications'/, 'notification active state must use currentPage');
assert.match(source, /aria-current=\{currentPage === 'notifications' \? 'page' : undefined\}/, 'notification control must expose current page semantics');
assert.match(source, /currentPage === 'chat'/, 'chat active state must use currentPage');
assert.match(source, /aria-current=\{currentPage === 'chat' \? 'page' : undefined\}/, 'chat control must expose current page semantics');
assert.match(source, /aria-label=\{l\('اعلان‌ها', 'Notifications', 'الإشعارات', '通知'\)\}/, 'notification label must be localized');
assert.match(source, /aria-label=\{t\('chatTitle'\)\}/, 'chat label must use the localized chat title');
assert.match(source, /onClick=\{\(\) => onNavigate\('notifications'\)\}/, 'notification control must keep navigation behavior');
assert.match(source, /onClick=\{onOpenChat\}/, 'chat control must keep chat behavior');

console.log('Header navigation accessibility checks passed.');
