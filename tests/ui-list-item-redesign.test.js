import fs from 'node:fs';
const app=fs.readFileSync('src/App.jsx','utf8');
const page=fs.readFileSync('src/pages/ListItemRedesign.jsx','utf8');
if(!app.includes("import ListItemRedesign from './pages/ListItemRedesign';")) throw new Error('missing import');
if(!app.includes("currentTab === 'list-item' && (useItemDetailRedesign ? <ListItemRedesign")) throw new Error('route not wired behind redesign flag');
for(const token of ['createItemListing','updateItem','cloudSyncService.compressImage','server-authoritative','contactInfo','localStorage']) {
  if(token==='localStorage') { if(page.includes(token)) throw new Error('listing redesign must not use localStorage'); }
  else if(!page.includes(token)) throw new Error('missing integration: '+token);
}
if(!page.includes('image/jpeg,image/png,image/webp')) throw new Error('missing image type restriction');
console.log('listing redesign regression checks passed');
