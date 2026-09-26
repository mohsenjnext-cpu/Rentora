import fs from 'fs';
import assert from 'assert';

const sidebar = fs.readFileSync('src/components/Sidebar.jsx', 'utf8');
const bottomNav = fs.readFileSync('src/components/BottomNav.jsx', 'utf8');

assert.match(sidebar, /aria-current=\{active \? 'page' : undefined\}/, 'sidebar primary nav buttons must expose active page semantics');
assert.match(sidebar, /aria-current=\{currentTab === 'chat' \? 'page' : undefined\}/, 'sidebar chat navigation must expose active page semantics');
assert.match(sidebar, /aria-current=\{currentTab === 'admin' \? 'page' : undefined\}/, 'sidebar admin navigation must expose active page semantics');
assert.match(sidebar, /aria-label=\{l\('بستن منو','Close menu','إغلاق القائمة','关闭菜单'\)\}/, 'mobile sidebar close control must be localized');

assert.match(bottomNav, /aria-current=\{isActive \? 'page' : undefined\}/, 'bottom navigation buttons must expose active page semantics');
assert.match(bottomNav, /aria-label=\{item\.label\}/, 'bottom navigation buttons must expose localized labels');

console.log('Sidebar and bottom navigation accessibility checks passed.');
