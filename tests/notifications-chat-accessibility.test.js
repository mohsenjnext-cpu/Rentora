import fs from 'fs';
import assert from 'assert';

const chat = fs.readFileSync('src/pages/ChatPage.jsx', 'utf8');
const notifications = fs.readFileSync('src/pages/NotificationsPage.jsx', 'utf8');

assert.match(chat, /aria-label=\{l\('به‌روزرسانی گفتگوها', 'Refresh conversations', 'تحديث المحادثات', '刷新会话'\)\}/, 'chat refresh control must use a localized accessible label');
assert.match(notifications, /aria-pressed=\{filter === key\}/, 'notification filters must expose their selected state');

console.log('Notifications and chat accessibility checks passed.');
