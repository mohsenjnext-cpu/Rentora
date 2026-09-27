import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/components/Header.jsx', 'utf8');

assert.match(source, /currentPage === 'notifications'/);
assert.match(source, /aria-current=\{currentPage === 'notifications' \? 'page' : undefined\}/);
assert.match(source, /currentPage === 'chat'/);
assert.match(source, /aria-current=\{currentPage === 'chat' \? 'page' : undefined\}/);
assert.match(source, /aria-label=\{l\('اعلان‌ها', 'Notifications', 'الإشعارات', '通知'\)\}/);
assert.match(source, /aria-label=\{t\('chatTitle'\)\}/);
assert.match(source, /onClick=\{\(\) => onNavigate\('notifications'\)\}/);
assert.match(source, /aria-label=\{t\('navProfile'\)\}/);
assert.match(source, /aria-label=\{l\('تغییر پوسته', 'Toggle theme', 'تبديل المظهر', '切换主题'\)\}/);
assert.match(source, /aria-label=\{l\('باز کردن منو', 'Open menu', 'فتح القائمة', '打开菜单'\)\}/);
assert.match(source, /aria-label=\{l\('به‌روزرسانی برنامه', 'Refresh app', 'تحديث التطبيق', '刷新应用'\)\}/);
assert.match(source, /aria-label=\{isAuthenticated \? t\('navProfile'\) : t\('navLogin'\)\}/);
assert.match(source, /onClick=\{onOpenChat\}/);

console.log('Header navigation accessibility checks passed.');
