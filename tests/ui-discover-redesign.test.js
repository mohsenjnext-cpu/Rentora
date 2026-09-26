import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const page = fs.readFileSync('src/pages/DiscoverRedesign.jsx', 'utf8');

if (!app.includes("import DiscoverRedesign from './pages/DiscoverRedesign';")) throw new Error('DiscoverRedesign import is missing');
if (!app.includes('currentTab === \'discover\'') || !app.includes('useItemDetailRedesign ? <DiscoverRedesign')) throw new Error('Discover route is not wired behind the redesign flag');
for (const token of ['useRentora', 'ItemCard', 'RentoraInput', 'RentoraButton', 'RentoraEmptyState', 'RentoraSkeleton']) {
  if (!page.includes(token)) throw new Error(`Discover redesign missing ${token}`);
}
for (const token of ['category', 'condition', 'maxPrice', 'sort', 'filtersOpen']) {
  if (!page.includes(token)) throw new Error(`Discover redesign missing filter state: ${token}`);
}
if (page.includes('localStorage.')) throw new Error('Discover redesign must not persist private state in localStorage');
console.log('discover redesign regression checks passed');
