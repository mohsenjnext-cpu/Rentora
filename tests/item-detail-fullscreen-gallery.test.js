import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ItemDetailPage.jsx', 'utf8');

assert(source.includes('galleryOpen'), 'Item detail should track fullscreen gallery state');
assert(source.includes('role="dialog"'), 'Fullscreen gallery should expose a dialog role');
assert(source.includes('aria-modal="true"'), 'Fullscreen gallery should be modal');
assert(source.includes("event.key === 'Escape'"), 'Fullscreen gallery should close with Escape');
assert(source.includes("document.body.style.overflow = 'hidden'"), 'Fullscreen gallery should lock page scroll');
assert(source.includes('Open fullscreen gallery'), 'Fullscreen gallery should expose an accessible open action');
assert(source.includes('Close gallery'), 'Fullscreen gallery should expose an accessible close action');
