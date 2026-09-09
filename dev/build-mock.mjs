// Builds a runnable mock of the dashboard from the real partials,
// stubbing google.script.run so the layout can be inspected locally.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'D:/task-tracker/appscript/';
const styles = readFileSync(SRC + 'DashboardStyles.html', 'utf8');
const body   = readFileSync(SRC + 'DashboardBody.html', 'utf8');

const hoursAgo = h => h;

const SAMPLE = [
  { taskId:'TASK-611', date:'Jan 20', summary:'Open Invoices', client:'Common', module:'FIN',
    assignedMember:'Isura', status:'New', priority:'High', timeSpentHrs:0,
    deadlineStr:'Jan 20, 17:00', isOverdue:true, hoursOvertime:hoursAgo(5255), hoursRemaining:null, isLive:false },
  { taskId:'TASK-612', date:'Jan 20', summary:'Customer Balance Summary report shows stale totals after a credit note is voided', client:'Common', module:'FIN',
    assignedMember:'Isura', status:'In Progress', priority:'Critical', timeSpentHrs:3.4,
    deadlineStr:'Sep 09, 17:00', isOverdue:false, hoursOvertime:null, hoursRemaining:2.5, isLive:true },
  { taskId:'TASK-613', date:'Jan 20', summary:'Customer Balance Detail', client:'Common', module:'FIN',
    assignedMember:'Eshani', status:'Paused', priority:'Medium', timeSpentHrs:12.75,
    deadlineStr:'Sep 12, 17:00', isOverdue:false, hoursOvertime:null, hoursRemaining:96, isLive:false },
  { taskId:'TASK-2459', date:'Sep 7', summary:'RS2109 reservation checkin issue "quoted" & <tagged>', client:'Canal View Garden', module:'FO',
    assignedMember:'Eshani', status:'New', priority:'Critical', timeSpentHrs:0,
    deadlineStr:'Sep 07, 23:59', isOverdue:true, hoursOvertime:19, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2460', date:'Sep 8', summary:'Bulk add dialog', client:'Task Management Application', module:'General',
    assignedMember:'Venul', status:'Done', priority:'Low', timeSpentHrs:5.25,
    deadlineStr:'Sep 08, 17:00', isOverdue:false, hoursOvertime:null, hoursRemaining:null, isLive:false },
  { taskId:'TASK-2461', date:'Sep 8', summary:'Sheet protection for automated columns', client:'Task Management Application', module:'General',
    assignedMember:'Senura', status:'Blocked', priority:'High', timeSpentHrs:1.1,
    deadlineStr:'Sep 10, 17:00', isOverdue:false, hoursOvertime:null, hoursRemaining:50, isLive:false }
];

const stub = `
<script>
window.google = { script: { run: (function () {
  var handlers = {};
  var api = {
    withSuccessHandler: function (fn) { handlers.ok = fn; return api; },
    withFailureHandler: function (fn) { handlers.err = fn; return api; },
    getSidebarTasks: function () {
      setTimeout(function () {
        handlers.ok({ tasks: ${JSON.stringify(SAMPLE)}, isManager: true, devName: null,
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
${styles}
</head><body>
<div class="header">
  <div><h2>Task Dashboard</h2><div class="who">Support: office.venulm@gmail.com</div></div>
  <button class="refresh-btn" onclick="loadTasks()">&#8635;</button>
</div>
${stub}
${body}
</body></html>`;

writeFileSync('D:/task-tracker/dev/_mock-dashboard.html', html);
console.log('wrote _mock-dashboard.html');
