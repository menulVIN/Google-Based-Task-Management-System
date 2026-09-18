// Runs the real Code.gs status/timer paths against an in-memory spreadsheet.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// ------------------------------------------------------------ fake Sheets API
function makeSheet(name, rows) {
  const data = rows.map(r => r.slice());          // data[r-1][c-1]
  const formats = {}, notes = {};
  const key = (r, c) => r + ':' + c;
  const cell = (r, c) => { while (data.length < r) data.push([]); return data[r - 1][c - 1]; };
  const put  = (r, c, v) => { while (data.length < r) data.push([]); data[r - 1][c - 1] = v; };
  const sheet = {
    getName: () => name,
    getLastRow: () => data.length,
    getMaxRows: () => Math.max(data.length, 100),
    deleteRow: (r) => { data.splice(r - 1, 1); },
    getRange(r, c, nr = 1, nc = 1) {
      const rg = {
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc, getSheet: () => sheet,
        getValue: () => { const v = cell(r, c); return v === undefined ? '' : v; },
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const v = cell(r + i, c + j); return v === undefined ? '' : v; })),
        setValue: (v) => { put(r, c, v); return rg; },
        setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => put(r + i, c + j, v))); return rg; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) put(r + i, c + j, ''); return rg; },
        setNote: (s) => { notes[key(r, c)] = s; return rg; },
        setNumberFormat: (f) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) formats[key(r + i, c + j)] = f; return rg; },
        createTextFinder: (text) => {
          const f = { matchEntireCell: () => f, matchCase: () => f,
            findNext: () => { for (let i = 0; i < nr; i++) if (String(cell(r + i, c)) === text) return sheet.getRange(r + i, c); return null; } };
          return f;
        }
      };
      return rg;
    },
    _data: data, _formats: formats, _notes: notes
  };
  return sheet;
}

const HEAD = ['Task ID','Date','Task Summary','Client','Module','Issue Type','Team Member (Submitting)','Assigned Member',
  'Total Time Spent (Hrs)','Deadline Date','Deadline Time','Completed Date','Completed Time','Status','Planned/Unplanned',
  'Priority Status','Remarks','Developer Remarks','Start Time','Reporting Client Name','Attachments','SVN Committed','Session Start'];
const row = (id, who, status, extra = {}) => {
  const r = new Array(23).fill('');
  r[0] = id; r[7] = who; r[13] = status;
  for (const [col, v] of Object.entries(extra)) r[col - 1] = v;
  return r;
};

function world() {
  const master = makeSheet('Master', [HEAD,
    row('TASK-1', 'Venul', 'New'),
    row('TASK-2', 'Venul', 'In Progress'),
    row('TASK-3', 'Venul', 'In Progress'),
    row('TASK-4', 'Venul', 'In Progress'),
    row('TASK-5', 'Eshara', 'Paused')]);
  const venul = makeSheet('Venul', [HEAD,
    row('TASK-1', 'Venul', 'New'), row('TASK-2', 'Venul', 'In Progress'),
    row('TASK-3', 'Venul', 'In Progress'), row('TASK-4', 'Venul', 'In Progress')]);
  const eshara = makeSheet('Eshara', [HEAD, row('TASK-5', 'Eshara', 'Paused')]);
  const sheets = { Master: master, Venul: venul, Eshara: eshara };
  const toasts = [];
  const ss = { getSheetByName: n => sheets[n] || null, toast: (m) => toasts.push(m), getUrl: () => '' };
  return { master, venul, eshara, ss, toasts };
}

// ------------------------------------------------------------- load Code.gs
const code = readFileSync('D:/task-tracker/appscript/Code.gs', 'utf8');
let W, lockBusy = false;
const ctx = {
  Logger: { log() {} }, console,
  Session: { getScriptTimeZone: () => 'Asia/Colombo', getActiveUser: () => ({ getEmail: () => 'office.venulm@gmail.com' }) },
  Utilities: { formatDate: (d) => d.toISOString() },
  LockService: { getScriptLock: () => ({ waitLock() { if (lockBusy) throw new Error('busy'); }, releaseLock() {} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => W.ss, flush() {} },
  MailApp: { sendEmail() {} }
};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const CDate = vm.runInContext('Date', ctx);
const hoursAgo = (h) => new CDate(Date.now() - h * 3600e3);

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FAIL  ') + m); if (!c) fails++; };
const v = (sheet, r, c) => sheet.getRange(r, c).getValue();
const approx = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.02;

// A user edit: set the cells (as Sheets does before onEdit fires), then fire.
function edit(sheet, r, c, values, ev = {}) {
  const vals = Array.isArray(values) ? values : [values];
  vals.forEach((val, i) => sheet.getRange(r + i, c).setValue(val));
  const range = sheet.getRange(r, c, vals.length, ev.cols || 1);
  ctx.onEdit(Object.assign({ range, source: W.ss }, ev.event || {}));
}

// ------------------------------------------------------------------- tests
console.log('\n== team tab, single cell ==');
W = world();
edit(W.venul, 2, 14, 'In Progress', { event: { value: 'In Progress', oldValue: 'New' } });
ok(v(W.master, 2, 14) === 'In Progress', 'New -> In Progress reaches Master');
ok(v(W.master, 2, 23) instanceof CDate && v(W.venul, 2, 23) instanceof CDate, 'session clock started on both');
ok(v(W.master, 2, 19) instanceof CDate, 'first Start Time stamped');

W = world();
W.master.getRange(3, 23).setValue(hoursAgo(2)); W.venul.getRange(3, 23).setValue(hoursAgo(2));
edit(W.venul, 3, 14, 'Paused', { event: { value: 'Paused', oldValue: 'In Progress' } });
ok(approx(v(W.master, 3, 9), 2) && approx(v(W.venul, 3, 9), 2), 'In Progress -> Paused banks 2.00h on both');
ok(v(W.master, 3, 23) === '' && W.master._formats['3:9'] === '0.00', 'session cleared, hours formatted 0.00');

console.log('\n== team tab, pasted single cell (event has no value) — used to be ignored ==');
W = world();
W.master.getRange(3, 23).setValue(hoursAgo(1.5));
edit(W.venul, 3, 14, 'Paused', { event: {} });
ok(v(W.master, 3, 14) === 'Paused', 'Master shows Paused');
ok(approx(v(W.master, 3, 9), 1.5), 'session banked 1.50h');

console.log('\n== team tab, dragged down three rows — used to be ignored ==');
W = world();
[3, 4, 5].forEach(r => W.master.getRange(r, 23).setValue(hoursAgo(1)));
edit(W.venul, 3, 14, ['Done', 'Done', 'Done']);
ok([3, 4, 5].every(r => v(W.master, r, 14) === 'Done'), 'all three Done on Master');
ok([3, 4, 5].every(r => approx(v(W.master, r, 9), 1)), 'each banked 1.00h');
ok([3, 4, 5].every(r => v(W.master, r, 12) instanceof CDate && v(W.master, r, 13) instanceof CDate), 'completion stamped');
ok(W.master._formats['3:12'] === 'M/d/yyyy' && W.master._formats['3:13'] === 'H:mm',
   'Completed Date formatted as date, Completed Time as time');
ok(W.venul._formats['3:13'] === 'H:mm', 'same formats on the team tab');

console.log('\n== Master, single cell — Master edits used to be ignored ==');
W = world();
W.master.getRange(3, 23).setValue(hoursAgo(3));
edit(W.master, 3, 14, 'Paused', { event: { value: 'Paused', oldValue: 'In Progress' } });
ok(approx(v(W.master, 3, 9), 3), 'banked 3.00h');
ok(v(W.venul, 3, 14) === 'Paused' && approx(v(W.venul, 3, 9), 3), 'team tab updated with status and hours');

console.log('\n== Master, two rows pasted (no oldValue) — previous status read from the tab ==');
W = world();
[3, 4].forEach(r => W.master.getRange(r, 23).setValue(hoursAgo(2)));
edit(W.master, 3, 14, ['Paused', 'Paused']);
ok(approx(v(W.master, 3, 9), 2) && approx(v(W.master, 4, 9), 2), 'both banked 2.00h');

console.log('\n== guards ==');
W = world();
edit(W.venul, 2, 14, '');
ok(v(W.venul, 2, 14) === 'New' && v(W.master, 2, 14) === 'New', 'clearing a status on the tab puts it back');
W = world();
edit(W.venul, 2, 14, 'Finished');
ok(v(W.venul, 2, 14) === 'New' && W.toasts.some(t => /Finished/.test(t)), 'unknown status put back, with a message');
W = world();
edit(W.venul, 2, 14, 'in progress');
ok(v(W.venul, 2, 14) === 'In Progress' && v(W.master, 2, 14) === 'In Progress', '"in progress" normalised to In Progress');
W = world();
lockBusy = true;
edit(W.venul, 3, 14, 'Paused', { event: {} });
lockBusy = false;
ok(v(W.venul, 3, 14) === 'In Progress' && v(W.master, 3, 14) === 'In Progress', 'lock busy: edit undone, nothing half-written');
ok(W.toasts.some(t => /undone/.test(t)), 'lock busy: person told to try again');
W = world();
W.venul.getRange(2, 14).setValue('Done'); W.venul.getRange(2, 15).setValue('Planned');
ctx.onEdit({ range: W.venul.getRange(2, 14, 1, 2), source: W.ss });
ok(v(W.master, 2, 14) === 'New' && W.toasts.some(t => /several columns/.test(t)), 'multi-column edit not synced, and says so');

console.log('\n== other columns ==');
W = world();
edit(W.venul, 2, 18, 'Waiting on the client', { event: {} });
ok(v(W.master, 2, 18) === 'Waiting on the client', 'pasted Developer Remark reaches Master (used to blank it)');

console.log('\n== reassignment still works ==');
W = world();
edit(W.master, 2, 8, 'Eshara', { event: { value: 'Eshara', oldValue: 'Venul' } });
ok(!W.venul._data.some(r => r[0] === 'TASK-1'), 'removed from Venul tab');
ok(W.eshara._data.some(r => r[0] === 'TASK-1'), 'added to Eshara tab');

console.log('\n== migration only converts old duration cells ==');
const base = new CDate(1899, 11, 30);
ok(approx(ctx.rawDayFraction_(new CDate(base.getTime() + 6 * 3600e3)) * 24, 6), 'duration cell 6:00 -> 6h');
ok(ctx.rawDayFraction_(2.5) === null, 'plain 2.5 (already hours) left alone');
ok(ctx.rawDayFraction_(new CDate(2026, 8, 11)) === null, 'calendar date left alone');
ok(ctx.rawDayFraction_('6 hours') === null, 'text left alone');

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'all passed'));
process.exit(fails ? 1 : 0);
