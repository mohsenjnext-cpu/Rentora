import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const page = fs.readFileSync('src/pages/SettingsRedesign.jsx', 'utf8');

if (!app.includes("import SettingsRedesign from './pages/SettingsRedesign';")) throw new Error('SettingsRedesign is not imported');
if (!app.includes("currentTab === 'settings' && (useItemDetailRedesign ? <SettingsRedesign")) throw new Error('Settings redesign is not behind redesign flag');
if (!page.includes('useLanguage') || !page.includes('useTheme') || !page.includes('usePiAuth')) throw new Error('Settings redesign must use app contexts');
if (page.includes('localStorage.getItem') || page.includes('localStorage.setItem') || page.includes('localStorage.removeItem')) throw new Error('Settings redesign must not persist private state in localStorage');
if (!page.includes('onOpenSecurity') || !page.includes('onOpenHelp') || !page.includes('onOpenSupport')) throw new Error('Settings actions are missing');
for (const section of ['Account & Identity', 'Security & Privacy', 'Notifications', 'Payments & Pi', 'Help & Rules', 'Support', 'About Rentora']) if (!page.includes(section)) throw new Error('Missing settings section: ' + section);
console.log('settings redesign regression checks passed');
