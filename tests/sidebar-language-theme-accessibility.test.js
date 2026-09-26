import fs from 'fs';
const sidebar = fs.readFileSync('src/components/Sidebar.jsx', 'utf8');

const assertions = [
  ['language selector is announced and exposes expanded state', sidebar.includes("aria-label={l('انتخاب زبان', 'Select language', 'اختيار اللغة', '选择语言')}") && sidebar.includes('aria-expanded={langMenuOpen}') && sidebar.includes('aria-haspopup="menu"')],
  ['language options expose radio semantics', sidebar.includes('role="menuitemradio"') && sidebar.includes('aria-checked={lang === code}')],
  ['sidebar theme control is localized', sidebar.includes("aria-label={l('تغییر پوسته', 'Toggle theme', 'تبديل المظهر', '切换主题')}")],
];

for (const [name, passed] of assertions) {
  if (!passed) throw new Error(`Assertion failed: ${name}`);
}

console.log(`Sidebar accessibility checks passed: ${assertions.length}`);
