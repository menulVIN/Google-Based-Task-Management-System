// Builds a runnable mock of the dashboard from the real partials,
// stubbing google.script.run so the layout can be inspected locally.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'D:/task-tracker/appscript/';
const tokens = readFileSync(SRC + 'Tokens.html', 'utf8');
const styles = readFileSync(SRC + 'DashboardStyles.html', 'utf8');
const body   = readFileSync(SRC + 'DashboardBody.html', 'utf8');

const hoursAgo = h => h;

const SAMPLE = [
  { taskId:'TASK-2463', date:'09/09/2026', summary:'Bill split total not matching on a closed table', client:'Riverstone Villas', module:'POS',
    assignedMember:'Venul', status:'In Progress', priority:'Critical', timeSpentHrs:2.23,
    deadlineStr:'09/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:3.1, isLive:true, idleHours:4.2, needsCheckIn:true },
  { taskId:'TASK-2500', date:'08/09/2026', summary:'VAT calculation issue in RS1279', client:'Accounts', module:'FO',
    assignedMember:'Eshani', status:'New', priority:'Critical', timeSpentHrs:0,
    deadlineStr:'08/09/2026 5:00 PM', isOverdue:true, hoursOvertime:19.4, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2496', date:'08/09/2026', summary:'RS1002 — reservation has 1 room but the invoice shows a different number of nights', client:'Sigiriya Bills', module:'FO',
    assignedMember:'Eshani', status:'Paused', priority:'High', timeSpentHrs:1.75,
    deadlineStr:'12/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:70, isLive:false },
  { taskId:'TASK-2479', date:'08/09/2026', summary:'Update backend project to suit HNB payment gateway', client:'Flute Mansion', module:'IBE',
    assignedMember:'Isura', status:'Blocked', priority:'High', timeSpentHrs:5.5,
    deadlineStr:'10/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:26, isLive:false },
  { taskId:'TASK-2461', date:'08/09/2026', summary:'Sheet protection for automated columns \"quoted\" & <tagged>', client:'Task Management Application', module:'General',
    assignedMember:'Senura', status:'Done', priority:'Low', timeSpentHrs:5.25,
    deadlineStr:'08/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2455', date:'07/09/2026', summary:'Agoda connection to the channel manager', client:'Sigiriya Bliss Hotel', module:'CM',
    assignedMember:'Janith', status:'New', priority:'Medium', timeSpentHrs:0,
    deadlineStr:'11/09/2026 5:00 PM', isOverdue:false, hoursOvertime:null, hoursRemaining:50, isLive:false }
];

const stub = `
<script>
window.google = { script: { run: (function () {
  var handlers = {};
  var api = {
    withSuccessHandler: function (fn) { handlers.ok = fn; return api; },
    withFailureHandler: function (fn) { handlers.err = fn; return api; },
    getTaskThread: function () {
      setTimeout(function(){ handlers.ok({ comments: [
        { initials:'ES', name:'Eshani', when:'2h ago', body:'Reproduced on the closed table — the split rounds each line before summing.' },
        { initials:'VM', name:'Venul',  when:'40m ago', body:'Found it. The rounding happens in the line loop, should be on the total.' }
      ]}); }, 150);
      return api;
    },
    addComment: function () {
      setTimeout(function(){ handlers.ok({ success:true, loggedMinutes:15, thread:[
        { initials:'ES', name:'Eshani', when:'2h ago', body:'Reproduced on the closed table.' },
        { initials:'VM', name:'Venul',  when:'just now', body:'Posted from the mock.' }
      ]}); }, 200);
      return api;
    },
    getSidebarTasks: function () {
      setTimeout(function () {
        handlers.ok({ tasks: ${JSON.stringify(SAMPLE)}, isManager: true, devName: null, email: "office.venulm@gmail.com", omittedOld: 2079, webAppUrl: "",
                      devNames: ['Isura','Venul','Eshani','Janith','Eshara','Senura','Unassigned','Lahiru','Aditha','Udara','JanithP'] });
      }, 120);
      return api;
    },
    updateStatusFromSidebar: function () { setTimeout(function(){ handlers.ok({success:true}); }, 200); return api; },
    bulkUpdateStatusFromSidebar: function (ids) { setTimeout(function(){ handlers.ok({success:true, updated:ids.length, failed:0}); }, 200); return api; }
  };
  return api;
})() } };
<\/script>`;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dashboard mock</title>
${tokens}
${styles}
</head><body>
</div>
${stub}
${body}
</body></html>`;

writeFileSync('D:/task-tracker/dev/_mock-dashboard.html', html);
console.log('wrote _mock-dashboard.html');
