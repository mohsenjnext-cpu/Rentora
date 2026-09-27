import fs from 'fs';
import assert from 'assert';

const chat = fs.readFileSync('src/pages/ChatPage.jsx', 'utf8');
const notifications = fs.readFileSync('src/pages/NotificationsPage.jsx', 'utf8');

assert.match(chat, /aria-label=\{l\('به‌روزرسانی گفتگوها', 'Refresh conversations', 'تحديث المحادثات', '刷新会话'\)\}/, 'chat refresh control must use a localized accessible label');
assert.match(notifications, /aria-pressed=\{filter === key\}/, 'notification filters must expose their selected state');

console.log('Notifications and chat accessibility checks passed.');


assert.match(notifications, /items \|\| \[\]\)\.filter\(item => \{/, 'listing notifications must filter to current user owned listings');
assert.match(notifications, /ownerUid && ownerUid === currentUser\.uid/, 'listing notifications must match the authenticated owner UID');
assert.match(notifications, /ownerUsername && username && ownerUsername === username/, 'listing notifications must fall back to the authenticated owner username');


assert.match(notifications, /role="status" aria-live="polite"/, 'notifications must expose a loading status');
assert.match(notifications, /role="alert"/, 'notifications must expose a recoverable load error');
assert.match(notifications, /onClick=\{refreshNotifications\}/, 'notifications retry must refresh authoritative account data');
assert.match(notifications, /const result = await refreshApp\?\.\(\)/, 'notifications refresh must use the real app sync path');


assert.match(chat, /role="status" aria-live="polite"/, 'chat must expose a loading status for conversations or messages');
assert.match(chat, /role="alert" aria-live="polite"/, 'chat warnings must be exposed as live alerts');
assert.match(chat, /onClick=\{\(\) => loadMessages\(selectedId\)\}/, 'chat message retry must reload the selected conversation');
