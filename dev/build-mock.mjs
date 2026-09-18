// Builds a runnable mock of the dashboard from the real partials,
// stubbing google.script.run so the layout can be inspected locally.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'D:/task-tracker/appscript/';
const tokens = readFileSync(SRC + 'Tokens.html', 'utf8');
const loader = readFileSync(SRC + 'Loader.html', 'utf8');
const styles = readFileSync(SRC + 'DashboardStyles.html', 'utf8');
const body   = readFileSync(SRC + 'DashboardBody.html', 'utf8');

const hoursAgo = h => h;

const SAMPLE = [
  { taskId:'TASK-2463', date:'09/09/2026', summary:'Bill split total not matching on a closed table', client:'Riverstone Villas', module:'POS',
    assignedMember:'Venul', status:'In Progress', priority:'Critical', timeSpentHrs:2.23,
    deadlineStr:'09/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:3.1, isLive:true, idleHours:4.2, needsCheckIn:true,
    remarks:'Closing table 12 with a 3-way split: the three shares add to 4,210.00 but the bill total is 4,209.99.',
    devRemarks:'Rounding is applied per line inside the loop.', reporter:'Front office — Sigiriya',
    attachments:'https://drive.google.com/file/d/1AbCdEf/view\nhttps://github.com/onesapro/pos/issues/412\nscreenshot sent on WhatsApp' },
  { taskId:'TASK-2500', date:'08/09/2026', summary:'VAT calculation issue in RS1279', client:'Accounts', module:'FO',
    assignedMember:'Eshani', status:'New', priority:'Critical', timeSpentHrs:0,
    deadlineStr:'08/09/2026 5:00 PM', isOverdue:true, hoursOvertime:19.4, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2496', date:'08/09/2026', summary:'RS1002 — reservation has 1 room but the invoice shows a different number of nights', client:'Sigiriya Bills', module:'FO',
    assignedMember:'Eshani', status:'Paused', priority:'High', timeSpentHrs:1.75,
    deadlineStr:'12/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:70, isLive:false },
  { taskId:'TASK-2479', date:'08/09/2026', summary:'Update backend project to suit HNB payment gateway', client:'Flute Mansion', module:'IBE',
    assignedMember:'Isura', status:'On Hold', priority:'High', timeSpentHrs:5.5,
    deadlineStr:'10/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:26, isLive:false },
  { taskId:'TASK-2461', date:'08/09/2026', summary:'Sheet protection for automated columns \"quoted\" & <tagged>', client:'Task Management Application', module:'General',
    assignedMember:'Senura', status:'Done', priority:'Low', timeSpentHrs:5.25,
    deadlineStr:'08/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2455', date:'07/09/2026', summary:'Agoda connection to the channel manager', client:'Sigiriya Bliss Hotel', module:'CM',
    assignedMember:'Janith', status:'Awaiting Info', priority:'Medium', timeSpentHrs:0,
    deadlineStr:'11/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:50, isLive:false }
];

/*
 * google.script.run stub.
 *
 * The real google.script.run hands out a FRESH runner on every access, so two
 * overlapping calls keep their own handlers. The first version of this stub
 * shared one object, which let a refresh overwrite a status change's handlers —
 * useless for testing double clicks. Each access now builds its own runner.
 *
 * Query string knobs:  ?delay=1500   server latency in ms (default 200)
 *                      ?fail=1       every write fails, to exercise the error paths
 * window.MOCK_CALLS counts calls per server function.
 */
const stub = `
<script>
(function () {
  var q = new URLSearchParams(location.search);
  var DELAY = +(q.get('delay') || 200);
  var FAIL  = q.get('fail') === '1';
  window.MOCK_CALLS = {};

  var SERVER = {
    getTaskThread: function () {
      return { comments: [
        { initials:'ES', name:'Eshani', when:'2h ago', body:'Reproduced on the closed table — the split rounds each line before summing.' },
        { initials:'VM', name:'Venul',  when:'40m ago', body:'Found it. The rounding happens in the line loop, should be on the total.' }
      ]};
    },
    addComment: function () {
      if (FAIL) throw new Error('Mock failure: addComment');
      return { success:true, loggedMinutes:15, thread:[
        { initials:'ES', name:'Eshani', when:'2h ago', body:'Reproduced on the closed table.' },
        { initials:'VM', name:'Venul',  when:'just now', body:'Posted from the mock.' }
      ]};
    },
    getSidebarTasks: function () {
      return { tasks: ${JSON.stringify(SAMPLE)}, isManager: true, devName: null, email: "office.venulm@gmail.com",
               omittedOld: 2079, webAppUrl: "",
               devNames: ['Isura','Venul','Eshani','Janith','Eshara','Senura','Unassigned','Lahiru','Aditha','Udara','JanithP'] };
    },
    updateStatusFromSidebar: function () {
      if (FAIL) throw new Error('Mock failure: updateStatusFromSidebar');
      return { success:true };
    },
    bulkUpdateStatusFromSidebar: function (ids) {
      if (FAIL) throw new Error('Mock failure: bulkUpdateStatusFromSidebar');
      return { success:true, updated:ids.length, failed:0 };
    }
  };

  function runner() {
    var ok = function () {}, err = function () {};
    var r = {
      withSuccessHandler: function (fn) { ok = fn; return r; },
      withFailureHandler: function (fn) { err = fn; return r; }
    };
    Object.keys(SERVER).forEach(function (name) {
      r[name] = function () {
        var args = arguments;
        window.MOCK_CALLS[name] = (window.MOCK_CALLS[name] || 0) + 1;
        setTimeout(function () {
          var out;
          try { out = SERVER[name].apply(null, args); } catch (e) { err(e); return; }
          ok(out);
        }, DELAY);
      };
    });
    return r;
  }

  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: runner });
})();
<\/script>`;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dashboard mock</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${tokens}
${loader}
${styles}
</head><body>
${stub}
${body}
</body></html>`;

writeFileSync('D:/task-tracker/dev/_mock-dashboard.html', html);
console.log('wrote _mock-dashboard.html');
