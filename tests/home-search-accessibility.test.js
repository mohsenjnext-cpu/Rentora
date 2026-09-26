import fs from 'node:fs';

const source = fs.readFileSync('src/pages/HomePage.jsx', 'utf8');

describe('Home search accessibility', () => {
  test('exposes autocomplete state and controls for suggestions', () => {
    expect(source).toContain('aria-expanded={searchFocused}');
    expect(source).toContain('aria-controls="home-search-suggestions"');
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain('id="home-search-suggestions"');
    expect(source).toContain('role="listbox"');
  });

  test('marks suggestion actions as selectable options', () => {
    expect(source).toContain('role="option"');
    expect(source).toContain('aria-selected="false"');
  });

  test('hides decorative search icons from assistive technology', () => {
    expect(source).toContain('<Search className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />');
    expect(source).toContain('<X className="w-3.5 h-3.5" aria-hidden="true" />');
  });
});
