import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const src = readFileSync(process.argv[2] || 'D:/task-tracker/appscript/Code.gs', 'utf8');
// reuse the fake sheet from test-time.mjs
const harness = readFileSync(process.argv[3] || 'D:/task-tracker/dev/tests/time.test.mjs', 'utf8');
const fake = harness.slice(harness.indexOf('function makeSheet'), harness.indexOf('// ------------------------------------------------------------- load Code.gs'));
const make = new Function(fake + '; return { makeSheet, HEAD, row, world };')();

let alertText = '';
const W = make.world();
for (const s of [W.master, W.venul, W.eshara]) {
  s.getLastColumn = () => 27;
  const orig = s.getRange;
  s.getRange = function (r, c, nr = 1, nc = 1) {
    const rg = orig.call(s, r, c, nr, nc);
    rg.getNotes = () => Array.from({ length: nr }, (_, i) => [s._notes[(r + i) + ':' + c] || '']);
    return rg;
  };
}
W.master.getRange(1, 25).setValue('Estimated Duration (Minutes)');
W.master.getRange(1, 27).setValue('Actual Duration (Minutes)');
W.ss.getSpreadsheetTimeZone = () => 'America/New_York';

const ctx = { Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Colombo' },
  Utilities: { formatDate: (d) => d.toISOString().slice(5, 16) },
  SpreadsheetApp: { getActiveSpreadsheet: () => W.ss, getUi: () => ({ alert: (t, m) => { alertText = m; }, ButtonSet: { OK: 1 } }) } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const D = vm.runInContext('Date', ctx);
const ago = h => new D(Date.now() - h * 3600e3);

// TASK-2,3,4 In Progress for Venul (several timers). 2: 30h old (over cap). 3: fresh. 4: no clock.
W.master.getRange(3, 23).setValue(ago(30));
W.master.getRange(4, 23).setValue(ago(1));
// TASK-5 Paused with a leftover session clock (lost session), capped note, and 2.5h
W.master.getRange(6, 23).setValue(ago(5));
W.master._notes['6:9'] = 'Ran 14.2h, capped at 8h. The timer was probably left running.';
// tab disagrees with Master on TASK-1
W.venul.getRange(2, 14).setValue('Paused');
// TASK-1 on Master: Done yesterday, no time
W.master.getRange(2, 14).setValue('Done'); W.master.getRange(2, 12).setValue(ago(24));
W.master.getRange(2, 25).setValue(90);

ctx.checkTimeTracking();
console.log(alertText);
const want = ['TIME ZONES DIFFER', 'SEVERAL TIMERS PER PERSON — 1', 'TIMERS PAST 8H — 1', 'IN PROGRESS WITHOUT A RUNNING CLOCK — 1',
  'SESSIONS NEVER BANKED — 1', 'TEAM TAB AND MASTER DISAGREE', 'SESSIONS CAPPED AT 8H — 1',
  'FINISHED IN THE LAST 30 DAYS WITH NO TIME — 1', 'Estimated Duration (Minutes) filled on 1'];
const missing = want.filter(w => !alertText.includes(w));
console.log('\n' + (missing.length ? 'MISSING: ' + missing.join(' | ') : 'report: every seeded problem found'));
process.exit(missing.length ? 1 : 0);
