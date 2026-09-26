import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/pages/HomePage.jsx', 'utf8');

test('Home search exposes autocomplete state and controls for suggestions', () => {
  assert.ok(source.includes('aria-expanded={searchFocused}'));
  assert.ok(source.includes('aria-controls="home-search-suggestions"'));
  assert.ok(source.includes('aria-autocomplete="list"'));
  assert.ok(source.includes('id="home-search-suggestions"'));
  assert.ok(source.includes('role="listbox"'));
});

test('Home search marks suggestion actions as selectable options', () => {
  assert.ok(source.includes('role="option"'));
  assert.ok(source.includes('aria-selected="false"'));
});

test('Home search hides decorative icons from assistive technology', () => {
  assert.ok(source.includes('<Search className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />'));
  assert.ok(source.includes('<X className="w-3.5 h-3.5" aria-hidden="true" />'));
});
