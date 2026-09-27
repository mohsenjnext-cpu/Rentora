import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/context/RentoraContext.jsx', 'utf8');

assert.match(
  source,
  /const saved = await cloudSyncService\.submitReport\(reportData\);\s*if \(!saved\) throw new Error\(/,
  'report submission must not create a local-only fallback when the server does not persist it'
);
assert.match(
  source,
  /const result = await cloudSyncService\.resolveReport\(reportId, 'resolved'\);\s*if \(!result\?\.success\) throw new Error\(/,
  'report resolution must surface a failed server mutation instead of reporting success'
);
assert.doesNotMatch(
  source,
  /setReports\(prev => prev\.filter\(r => r\.id !== reportId\)\);\s*return \{ success: true \};/,
  'report resolution must not remove the report locally after a swallowed server failure'
);

console.log('Report mutation authority checks passed.');
