// Runs the real Code.gs bulk parser against the work-log TSV and edge cases.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const code = readFileSync('D:/task-tracker/appscript/Code.gs', 'utf8');
const ctx = {
  Logger: { log() {} },
  Session: { getScriptTimeZone: () => 'Asia/Colombo' },
  Utilities: { formatDate: (d, tz, f) => d.toISOString().slice(0, 16).replace('T', ' ') },
  console
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const CtxDate = vm.runInContext('Date', ctx);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) fails++; };
const hasDate = (v) => v instanceof CtxDate || v instanceof Date ||
  (v && typeof v === 'object' && Object.values(v).some(hasDate));

// ---------------------------------------------------------------- the real file
console.log('\n== docs/bulk-import-work-log.tsv through checkBulkRows_ ==');
const tsv = readFileSync('D:/task-tracker/docs/bulk-import-work-log.tsv', 'utf8');
const full = ctx.checkBulkRows_(tsv);
ok(!full.error, 'no batch-level error' + (full.error ? ': ' + full.error : ''));
ok(full.rows.length === 21, full.rows.length + ' rows parsed (header skipped)');
ok(full.errorCount === 0, full.errorCount + ' rows with errors');
full.rows.filter(r => r.errors.length || r.warnings.length).forEach(r =>
  console.log('        line ' + r.lineNo + ': ' + r.errors.concat(r.warnings).join(' | ')));

const done = full.rows.filter(r => r.data.status === 'Done');
ok(done.length === 19, done.length + ' rows Done, ' + (21 - done.length) + ' On Hold');
ok(done.every(r => r.data.completedAt instanceof CtxDate), 'every Done row has a completion Date');

const r0 = full.rows[0].data;
ok(r0.createdAt.getFullYear() === 2026 && r0.createdAt.getMonth() === 8 && r0.createdAt.getDate() === 9 &&
   r0.createdAt.getHours() === 16 && r0.createdAt.getMinutes() === 24, 'row 1 created 2026-09-09 16:24 (local)');
const r15 = full.rows[15].data;   // reassignment: 19:47 -> 19:58
ok(r15.completedAt.getHours() === 19 && r15.completedAt.getMinutes() === 58, 'row 16 completed at 19:58');

// ------------------------------------------------------- reply sent to the page
console.log('\n== validateBulkRows reply (what crosses google.script.run) ==');
const reply = ctx.validateBulkRows(tsv);
ok(!hasDate(reply), 'reply contains no Date objects');
ok(reply.rows.every(r => !('data' in r)), 'rows carry verdicts only, no parsed data');
ok(reply.validCount === 21 && reply.errorCount === 0, 'counts preserved: ' + reply.validCount + ' valid');
console.log('        preview: ' + reply.rows[0].preview);

// ------------------------------------------------------------------ row builder
console.log('\n== buildRow_ ==');
const built = ctx.buildRow_('TASK-9001', r0.createdAt, 'office.venulm@gmail.com', 'Venul', r0);
ok(built.length === 22, 'row is 22 columns');
ok(built[1] === r0.createdAt, 'col 2 Date is the created date, not now');
ok(built[13] === 'Done', 'col 14 Status is Done');
ok(built[11] === r0.completedAt && built[12] === r0.completedAt, 'cols 12/13 hold the completion Date');
ok(built[8] === '', 'col 9 hours blank (not measured)');
const formRow = ctx.buildRow_('TASK-9002', new Date(), 'x@y.com', 'Venul',
  { taskSummary: 'form task', client: 'c', module: 'FO', priorityStatus: 'Low', deadlineDate: '2026-09-20' });
ok(formRow[13] === 'New' && formRow[8] === '' && formRow[11] === '' && formRow[12] === '',
   'a form submission still lands New, empty time, no completion');

// ------------------------------------------------------------------ edge cases
console.log('\n== validation edge cases ==');
const HEAD = (o) => {
  const c = new Array(23).fill('');
  Object.assign(c, { 0: '[AUTO]', 2: 'Test summary', 3: 'Client', 4: 'General', 7: 'Venul', 15: 'Low' }, o);
  return c.join('\t');
};
const one = (o) => ctx.checkBulkRows_(HEAD(o)).rows[0];
const errs = (o) => one(o).errors.join(' | ');

ok(one({}).errors.length === 0 && one({}).data.status === 'New' && one({}).data.createdAt === null,
   'all finished-work columns blank: valid, New, created now');
ok(/timer/.test(errs({ 13: 'In Progress' })), 'In Progress refused');
ok(/Completed Date/.test(errs({ 13: 'Done' })), 'Done without a completed date refused');
ok(/future/.test(errs({ 1: '2099-01-01 10:00' })), 'future created date refused');
ok(/future/.test(errs({ 13: 'Done', 11: '2099-01-01' })), 'future completion refused');
ok(/before it was created/.test(errs({ 1: '2026-09-10 12:00', 13: 'Done', 11: '2026-09-10', 12: '11:00' })),
   'completed before created refused');
ok(/status is New/.test(errs({ 11: '2026-09-10' })), 'completed date with a non-Done status refused');
ok(/plain hours/.test(errs({ 8: '2 Hours' })), '"2 Hours" refused as time spent');
ok(one({ 8: '2.5' }).data.hours === 2.5 && one({ 8: '2.5' }).errors.length === 0, '2.5 accepted as hours');
ok(one({ 8: '140' }).warnings.some(w => /unusually high/.test(w)), '140h warns');
ok(/not understood/.test(errs({ 1: '10/09/2026 25:99' })), 'bad time in Date refused, not dropped');
ok(one({ 13: 'Done', 11: '09/10/2026', 12: '5:30 PM' }).data.completedAt.getHours() === 17,
   'mm/dd/yyyy + "5:30 PM" parses to 17:30');
ok(/not a valid status/.test(errs({ 13: 'Finished' })), 'unknown status refused');
const withDeadline = ctx.validateBulkRows(HEAD({ 9: '2026-09-20', 10: '17:00' }));
ok(!hasDate(withDeadline), 'a row with a deadline no longer puts a Date in the reply (the Check rows bug)');

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'all passed'));
process.exit(fails ? 1 : 0);
