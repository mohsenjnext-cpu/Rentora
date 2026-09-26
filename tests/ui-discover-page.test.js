import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const page = fs.readFileSync('src/pages/DiscoverPage.jsx', 'utf8');

if (!app.includes("currentTab === 'discover'")) throw new Error('Discover route is missing');
if (!page.includes('useRentora')) throw new Error('Discover must use authoritative Rentora context data');
if (!page.includes('RentoraInput') || !page.includes('RentoraButton') || !page.includes('RentoraEmptyState') || !page.includes('RentoraSkeleton')) throw new Error('Discover must use the shared design system');
if (page.includes('localStorage')) throw new Error('Discover must not persist private marketplace state in localStorage');
if (page.includes('setTimeout(')) throw new Error('Discover must not fake loading or delivery with timers');
if (!page.includes('selectedCategory') || !page.includes('sortBy') || !page.includes('selectedCondition')) throw new Error('Discover filters/sort controls are missing');
console.log('discover page regression checks passed');
