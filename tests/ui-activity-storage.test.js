import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('activity history clear does not persist private state to localStorage', () => {
  const source = fs.readFileSync(new URL('../src/pages/ActivityPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /const \[clearedHistoryTime, setClearedHistoryTime\] = useState\(0\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(clearedKey/);
  assert.doesNotMatch(source, /localStorage\.getItem\(clearedKey/);
});
