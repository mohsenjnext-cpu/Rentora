import test from 'node:test';
import assert from 'node:assert/strict';

const read = async (path) => {
  const response = await fetch(`https://raw.githubusercontent.com/mohsenjnext-cpu/Rentora/codex/ui-ux-redesign-tracker/${path}`);
  assert.equal(response.ok, true);
  return response.text();
};

test('Discover adopts shared UI primitives', async () => {
  const source = await read('src/pages/DiscoverPage.jsx');
  assert.match(source, /import RentoraInput/);
  assert.match(source, /import RentoraButton/);
  assert.match(source, /import RentoraModal/);
  assert.match(source, /import RentoraEmptyState/);
  assert.doesNotMatch(source, /import EmptyState from ['"]\.\.\/components\/EmptyState/);
});

test('Discover keeps filtering and ItemCard business integration', async () => {
  const source = await read('src/pages/DiscoverPage.jsx');
  assert.match(source, /const filteredItems = useMemo/);
  assert.match(source, /onSelect=\{onSelectItem\}/);
  assert.match(source, /onRentClick=\{onRentItem\}/);
  assert.match(source, /setSelectedCategory/);
  assert.match(source, /setSelectedCondition/);
  assert.match(source, /setSelectedCity/);
  assert.match(source, /setMaxPrice/);
});

test('RentoraInput provides safe ids and reusable adornments', async () => {
  const source = await read('src/components/ui/RentoraInput.jsx');
  assert.match(source, /useId/);
  assert.match(source, /inputId = id \|\| props\.name \|\|/);
  assert.match(source, /leadingAdornment/);
  assert.match(source, /trailingAdornment/);
});


test('Discover exposes accessible semantics for sorting and category filters', async () => {
  const source = await read('src/pages/DiscoverPage.jsx');
  assert.match(source, /htmlFor="discover-sort"/);
  assert.match(source, /id="discover-sort"/);
  assert.match(source, /aria-pressed=\{isSel\}/);
  assert.match(source, /aria-labelledby="discover-category-label"/);
});
