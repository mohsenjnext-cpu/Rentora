import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const page = fs.readFileSync('src/pages/AdminDashboardRedesign.jsx', 'utf8');

assert.match(app, /import AdminDashboardRedesign from ['"]\.\/pages\/AdminDashboardRedesign['"]/);
assert.match(app, /currentTab === ['"]admin['"][\s\S]*useItemDetailRedesign \? <AdminDashboardRedesign/);
assert.match(page, /\/api\/admin\/console/);
assert.match(page, /credentials:\s*['"]include['"]/);
assert.match(page, /usePiAuth/);
assert.match(page, /dir=["']rtl["']/);
assert.match(page, /Open reports|گزارش‌های باز/);
assert.match(page, /Payouts in flight|پرداخت‌های در جریان/);
assert.doesNotMatch(page, /localStorage\.(getItem|setItem|removeItem)/);

console.log('Admin redesign wiring and security regression checks passed.');
