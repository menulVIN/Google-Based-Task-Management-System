// Runs every test against appscript/Code.gs.   node dev/tests/run.mjs
import { spawnSync } from 'node:child_process';
const tests = ['time.test.mjs', 'time-report.test.mjs', 'bulk-add.test.mjs'];
let failed = 0;
for (const t of tests) {
  const r = spawnSync(process.execPath, ['D:/task-tracker/dev/tests/' + t], { encoding: 'utf8' });
  const last = (r.stdout.trim().split('\n').pop() || '') + (r.stderr ? ' ' + r.stderr.trim().split('\n')[0] : '');
  console.log((r.status === 0 ? 'pass  ' : 'FAIL  ') + t.padEnd(24) + last);
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
