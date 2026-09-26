import fs from 'fs';
const footer = fs.readFileSync('src/components/Footer.jsx', 'utf8');

if (!footer.includes("const { dir, l } = useLanguage();")) throw new Error('Footer must consume localized language helper');
if (!footer.includes("Powered by Pi Network Blockchain")) throw new Error('English attribution missing');
if (!footer.includes("مبتنی بر شبکه بلاک‌چین Pi")) throw new Error('Persian attribution missing');
if (!footer.includes("مدعوم بشبكة Pi")) throw new Error('Arabic attribution missing');
if (!footer.includes("由 Pi Network 区块链提供支持")) throw new Error('Chinese attribution missing');

console.log('Footer localization checks passed: 5');
