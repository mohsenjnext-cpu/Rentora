import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('final regression: browser history preserves chat target state', () => {
  const app = read('src/App.jsx');
  assert.match(app, /const getNavigationState = \(\) => \(\{[\s\S]*chatInitialConversationId,/);
  assert.match(app, /setChatInitialConversationId\(state\.chatInitialConversationId \|\| null\)/);
});

test('final regression: listing creation has no synthetic marketplace fallbacks', () => {
  const context = read('src/context/RentoraContext.jsx');
  assert.doesNotMatch(context, /images\.unsplash\.com/);
  assert.doesNotMatch(context, /api\.dicebear\.com/);
  assert.doesNotMatch(context, /location \|\| 'ایران'/);
  assert.match(context, /حداقل یک تصویر واقعی از کالا لازم است/);
});
