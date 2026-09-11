/**
 * Task Management Master Log — Apps Script backend
 * Bound to the Master spreadsheet; also deployed as a web app.
 *
 * Source of truth is this repo file. Edit here, paste into the Apps Script
 * editor, save. Do not edit only in the editor — the editor copy is not backed up.
 *
 * Master column map (1-indexed):
 *   1 Task ID            2 Date               3 Task Summary       4 Client
 *   5 Module             6 Issue Type         7 Submitter Email    8 Assigned Member
 *   9 Approx Time (Hrs) 10 Deadline Date     11 Deadline Time     12 Completed Date
 *  13 Completed Time    14 Status            15 Planned/Unplanned 16 Priority
 *  17 Remarks           18 Developer Remark  19 Start Time        20 Reporting Client
 *  21 Attachments       22 SVN Committed     23 Session Start
 */

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

/** Active team. Every name here needs a matching sheet tab. */
var DEV_EMAILS = {
  'Isura':      'office.isura@gmail.com',
  'Venul':      'office.venulm@gmail.com',
  'Eshani':     'eshanij@ticti.com',
  'Janith':     'office.janitha@gmail.com',
  'Eshara':     'office.eshara@gmail.com',
  'Senura':     'office.senurav@gmail.com',
  'Unassigned': 'office.venulm@gmail.com'
};

var DEVELOPER_SHEET_NAMES = [
  'Isura', 'Venul', 'Eshani', 'Janith', 'Eshara', 'Senura', 'Unassigned'
];

/**
 * Left the company. Tabs kept so their history stays readable and filterable;
 * they never appear in an assignment dropdown and never receive new work.
 */
var ARCHIVED_DEVELOPER_SHEETS = ['Lahiru', 'Aditha', 'Udara', 'JanithP'];

/** Sees every task and gets the developer filter. Unchanged behaviour. */
var MANAGER_EMAILS = [
  'eshanij@ticti.com',
  'office.isura@gmail.com',
  'office.venulm@gmail.com'
];

var MASTER_SHEET_NAME    = 'Master';
var SUPPORT_SHEET_NAME   = 'Support Tracker';
var COMMENTS_SHEET_NAME  = 'Comments';

/** Minutes credited to a task when someone posts an update on it. */
var COMMENT_LOGS_MINUTES = 15;

/** No note and no status change for this long on a running task triggers the nudge. */
var CHECKIN_IDLE_HOURS = 4;
var ATTACHMENT_FOLDER_ID = '1o-YGGzVR3VjXoMFmX1hAl7usJ2OUBcoy';

var MASTER_COL_TASK_ID  = 1;
var MASTER_COL_ASSIGNED = 8;
var ASSIGNED_MEMBER_COL = 8;
var TOTAL_TIME_COL      = 9;
var START_TIME_COL      = 19;
var SESSION_START_COL   = 23;
var LAST_MASTER_COL     = 22;

/**
 * The canonical 23 headers. Master and every team tab must match this exactly.
 *
 * This lives in code, not in the sheet, because the sheet has drifted: Master's
 * column 22 header is blank (the SVN data is written there, but the heading was
 * never filled in), and tabs disagree on "Developer Remark" vs "Remarks".
 * Copying headers from Master would spread that drift to every new tab.
 */
var MASTER_HEADERS = [
  'Task ID', 'Date', 'Task Summary', 'Client', 'Module', 'Issue Type',
  'Team Member (Submitting)', 'Assigned Member', 'Total Time Spent (Hrs)',
  'Deadline Date', 'Deadline Time', 'Completed Date', 'Completed Time', 'Status',
  'Planned/Unplanned', 'Priority Status', 'Remarks', 'Developer Remarks',
  'Start Time', 'Reporting Client Name', 'Attachments', 'SVN Committed', 'Session Start'
];

/**
 * Header text -> Master column. onEdit looks the edited column's header up here,
 * so every spelling that actually appears in Master's row 1 must be present or
 * that column silently stops syncing. Aliases are deliberate, not duplicates.
 */
var SYNC_COLUMNS = {
  'Total Time Spent (Hrs)': 9,   // the real header in Master
  'Approximate Time (Hrs)': 9,   // alias — older sheets
  'Completed Date':        12,
  'Completed Time':        13,
  'Status':                14,
  'Remarks':               17,
  'Developer Remark':      18,
  'Developer Remarks':     18,   // alias — plural
  'Start Time':            19,
  'Reporting Client Name': 20,
  'Attachments':           21,
  'SVN Committed':         22,
  'NA':                    23,   // the real header in Master for the session clock
  'Session Start':         23    // alias
};

/**
 * Columns that stay hand-editable once the sheets are locked.
 * 14 Status · 18 Developer Remark · 22 SVN Committed
 * Everything else is automated and must not be typed over.
 */
var SHEET_EDITABLE_COLUMNS = [14, 18, 22];

var PROTECTION_TAG = 'Tracker — automated columns locked';

/** Single source of truth for every dropdown: sheet, form, and bulk import. */
var ALLOWED = {
  /**
   * These are the statuses actually in the sheet, in the sheet's own order.
   * "On Hold" and "Awaiting Info" are long-standing values; leaving them out
   * would make every row that uses one unwritable, because a strict rule makes
   * setValues throw — which would break row copies and the sync audit.
   * "Blocked" is the one addition, and nothing has used it yet.
   */
  status:   ['New', 'In Progress', 'On Hold', 'Awaiting Info', 'Paused', 'Done', 'Blocked'],
  priority: ['Critical', 'High', 'Medium', 'Low'],
  planned:  ['Unplanned', 'Planned'],   // order matches the form people are used to
  svn:      ['Yes', 'No'],
  module: [
    'FO', 'CM', 'IBE', 'POS', 'POS Manager', 'INV', 'FIN', 'EGRC', 'RM', 'HR',
    'HK', 'QR', 'Sync', 'General', 'Red Cherries Finance Syncr',
    'SE to EE Data Sync', 'Eco Delivery', 'IBE Admin', 'Valuation ERP',
    'QR/Tab Ordering', 'Other'
  ],
  issueType: [
    'Bug-Core', 'Bug-Channel', 'Change-Feature', 'Change-Modification',
    'Dev-Custom', 'Dev-Integration', 'Infra-Deployment', 'Infra-Admin',
    'Implementation-New', 'QA-Docs', 'Admin-Data', 'Admin-Meetings',
    'Rework', 'Other'
  ]
};

/**
 * What the form SHOWS for each stored value.
 *
 * The sheet stores the short code; people pick from the description. Sending
 * only the codes to the form turned every dropdown into jargon — keep these in
 * step with ALLOWED above, and never let a label leak into a stored value.
 */
var LABELS = {
  issueType: {
    'Bug-Core':           '1. Core System Bug / Fix',
    'Bug-Channel':        '2. Channel Specific Bug (POS/IBE/QR/Call Center)',
    'Change-Feature':     '3. New Feature / Requirement',
    'Change-Modification':'4. Existing System Modification / Report Change',
    'Dev-Custom':         '5. Custom Development / Design / Artworks',
    'Dev-Integration':    '6. Integrations',
    'Infra-Deployment':   '7. Deployment / Hosting / Infrastructure',
    'Infra-Admin':        '8. Server/Linux Management / Admin Tasks',
    'Implementation-New': '9. System Implementation / Org Creation',
    'QA-Docs':            '10. QA Related / Documentation Prep',
    'Admin-Data':         '11. Manual Data Insertion / Admin Tasks',
    'Admin-Meetings':     '12. Meetings / General Inquiry / Concerns',
    'Rework':             '13. Rework (Bug / Feature)',
    'Other':              '14. Other / General'
  },
  module: {
    'FO':'Front Office (FO)', 'CM':'Channel Manager (CM)',
    'IBE':'Internet Booking Engine (IBE)', 'POS':'Point of Sale (POS)',
    'POS Manager':'POS Manager', 'INV':'Inventory/Stock Management (INV)',
    'FIN':'Finance/Accounting (FIN)', 'EGRC':'EGRC',
    'RM':'Revenue Management (RM)', 'HR':'Human Resources (HR)',
    'HK':'Housekeeping (HK)', 'QR':'QR Ordering/Scanning',
    'Sync':'Data Sync/Integration Engine', 'General':'General / Platform-Wide',
    'Red Cherries Finance Syncr':'Red Cherries Finance Sync',
    'SE to EE Data Sync':'SE to EE Data Sync', 'Eco Delivery':'Eco Delivery',
    'IBE Admin':'IBE Admin', 'Valuation ERP':'Valuation ERP',
    'QR/Tab Ordering':'QR/Tab Ordering', 'Other':'Other / Not Listed'
  },
  priority: {
    'Critical':'Critical (P0)', 'High':'High (P1)',
    'Medium':'Medium (P2)',     'Low':'Low (P3)'
  },
  planned: {
    'Unplanned':'Unplanned (Bug/Emergency)',
    'Planned':'Planned (Scheduled Work)'
  }
};

/** [{v: stored value, l: what the user reads}] for a <select>. */
function labelled_(values, labels) {
  return values.map(function (v) { return { v: v, l: (labels && labels[v]) || v }; });
}

var BULK_MAX_ROWS = 200;

/**
 * Dashboard window. Master holds thousands of rows and a manager has no
 * per-person filter, so an unbounded read builds thousands of objects and tens
 * of thousands of DOM nodes in a 420px iframe — it looks like a hang.
 * Finished work older than this drops out unless "include finished" is ticked.
 */
var DONE_WINDOW_DAYS = 30;
var DASHBOARD_MAX_TASKS = 400;

/**
 * TIME TRACKING — read this before changing anything that touches column 9.
 *
 * UNITS. Column 9 is headed "Total Time Spent (Hrs)" but stores a DAY FRACTION,
 * because Sheets duration formatting works in days. 0.25 means six hours, not
 * fifteen minutes. Any KPI formula reading the raw cell must multiply by 24.
 * Use readStoredHours_() to read and write plain hours. Never assume
 * the cell is a plain number — a duration-formatted cell returns a Date.
 *
 * MEASUREMENT. Elapsed time is wall-clock between Start and the next status
 * change. It does not know about evenings, weekends or lunch. The common
 * failure is a timer left running, so a single sitting is capped and annotated
 * rather than allowed to log sixteen hours of "work".
 */
var MAX_SESSION_HOURS = 8;

// ---------------------------------------------------------------------------
// IDENTITY
// ---------------------------------------------------------------------------

function currentEmail_() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
}

function isManager() {
  var me = currentEmail_();
  if (!me) return false;
  for (var i = 0; i < MANAGER_EMAILS.length; i++) {
    if (MANAGER_EMAILS[i].toLowerCase() === me) return true;
  }
  return false;
}

function currentDevName_() {
  var me = currentEmail_();
  if (!me) return null;
  for (var name in DEV_EMAILS) {
    if (String(DEV_EMAILS[name]).toLowerCase() === me) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Last row with a value in column A. getLastRow() over-reports on formatted blanks. */
function getRealLastRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return 0;
  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '' && values[i][0] != null) return i + 1;
  }
  return 0;
}

/**
 * Row number for a task id, searching column A ONLY.
 * An unscoped sheet-wide TextFinder would match a task id quoted inside
 * someone's Remarks before it reached the real row.
 */
function findRowInSheet_(sheet, taskId) {
  var lastRow = getRealLastRow(sheet);
  if (lastRow < 2) return null;
  var hit = sheet.getRange(2, MASTER_COL_TASK_ID, lastRow - 1, 1)
                 .createTextFinder(String(taskId))
                 .matchEntireCell(true)
                 .matchCase(true)
                 .findNext();
  return hit ? hit.getRow() : null;
}

function findMasterRowById(taskId, masterSheet) { return findRowInSheet_(masterSheet, taskId); }
function findRowInDevSheet(sheet, taskId)       { return findRowInSheet_(sheet, taskId); }

function allTaskSheetNames_() {
  return DEVELOPER_SHEET_NAMES.concat(ARCHIVED_DEVELOPER_SHEETS);
}

/** Duration cells come back as Date. Normalise to a day fraction before adding. */
/**
 * Reads column 9 as DECIMAL HOURS.
 *
 * 2.5 means two and a half hours. The column used to hold a day fraction
 * (0.25 = six hours) because Sheets duration formatting works in days, which
 * meant the header said "(Hrs)" while SUM() returned a twenty-fourth of the
 * real figure. Storing hours makes the header true and the KPI arithmetic
 * plain. migrateTimeToHours() converts the historical values once.
 *
 * A duration-FORMATTED cell still hands back a Date, so that case is converted
 * from days to hours here.
 */
function readStoredHours_(value) {
  if (value instanceof Date) {
    var base = new Date(1899, 11, 30);
    return ((value.getTime() - base.getTime()) / (24 * 60 * 60 * 1000)) * 24;
  }
  if (typeof value === 'number') return isFinite(value) ? value : 0;

  // Older rows hold text like "2 Hours" or "mora than a Day" from a legacy
  // dropdown. parseFloat("2 Hours") is 2, which would silently become 2 hours
  // of work nobody logged. Only a bare number counts.
  var s = String(value == null ? '' : value).trim();
  if (!s) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    Logger.log('Ignoring non-numeric time value: "' + s + '"');
    return 0;
  }
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** Kept for the historical backfill script, which still works in day fractions. */
function toDayFraction_(value) { return readStoredHours_(value) / 24; }

var PROP_TIME_IN_HOURS = 'TIME_MIGRATED_TO_HOURS';

/** The raw stored number BEFORE migration, when the column held day fractions. */
function rawDayFraction_(value) {
  if (value instanceof Date) {
    var base = new Date(1899, 11, 30);
    return (value.getTime() - base.getTime()) / (24 * 60 * 60 * 1000);
  }
  if (typeof value === 'number') return isFinite(value) ? value : null;
  var s = String(value == null ? '' : value).trim();
  if (!s) return null;
  return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;   // null = leave alone
}

/**
 * One-off: converts column 9 from day fractions to decimal hours (x24) across
 * Master and every task tab, and clears any duration number format so 2.5
 * reads as 2.5 hours rather than being redrawn as 60:00.
 *
 * Runs dry the first time and shows exactly what it would change. Refuses to
 * run twice — the flag lives in Script Properties, because running it again
 * would multiply everything by 24 a second time.
 */
function migrateTimeToHours() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  if (props.getProperty(PROP_TIME_IN_HOURS)) {
    ui.alert('Already migrated',
      'Column 9 was converted to hours on ' + props.getProperty(PROP_TIME_IN_HOURS) + '.\n\n' +
      'Running it again would multiply every value by 24 a second time, so this is blocked.',
      ui.ButtonSet.OK);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = [MASTER_SHEET_NAME].concat(allTaskSheetNames_());
  var plan = [], totalCells = 0, skipped = 0;

  sheets.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var last = getRealLastRow(sheet);
    if (last < 2) return;

    var vals = sheet.getRange(2, TOTAL_TIME_COL, last - 1, 1).getValues();
    var changed = 0, sample = [];
    for (var i = 0; i < vals.length; i++) {
      var frac = rawDayFraction_(vals[i][0]);
      if (frac === null || frac === 0) { if (vals[i][0] !== '' && frac === null) skipped++; continue; }
      changed++;
      if (sample.length < 3) sample.push(frac.toFixed(4) + ' → ' + (frac * 24).toFixed(2) + 'h');
    }
    totalCells += changed;
    if (changed) plan.push('  ' + name + ': ' + changed + ' value(s)   e.g. ' + sample.join(' · '));
  });

  if (!totalCells) {
    ui.alert('Nothing to migrate', 'No numeric time values were found.', ui.ButtonSet.OK);
    return;
  }

  var go = ui.alert('Convert time to hours?',
    'Column 9 currently holds a day fraction, so 0.25 means six hours and the\n' +
    'header "(Hrs)" is wrong. This multiplies every value by 24 so the number\n' +
    'is the hours, and clears any duration formatting.\n\n' +
    plan.join('\n') + '\n\n' +
    totalCells + ' value(s) across ' + plan.length + ' sheet(s).' +
    (skipped ? '\n' + skipped + ' non-numeric value(s) will be left untouched.' : '') +
    '\n\nMAKE A COPY OF THE SHEET FIRST (File > Make a copy).\n' +
    'This cannot be undone from here and can only be run once.\n\nProceed?',
    ui.ButtonSet.YES_NO);
  if (go !== ui.Button.YES) return;

  var done = [];
  sheets.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var last = getRealLastRow(sheet);
    if (last < 2) return;

    var range = sheet.getRange(2, TOTAL_TIME_COL, last - 1, 1);
    var vals = range.getValues();
    var out = [], n = 0;
    for (var i = 0; i < vals.length; i++) {
      var frac = rawDayFraction_(vals[i][0]);
      if (frac === null) { out.push([vals[i][0]]); continue; }   // leave text as it is
      if (frac === 0)    { out.push(['']); continue; }
      out.push([Math.round(frac * 24 * 100) / 100]);
      n++;
    }
    range.setNumberFormat('0.00');   // a duration format would redraw 2.5 as 60:00
    range.setValues(out);
    if (n) done.push(name + ' (' + n + ')');
  });

  props.setProperty(PROP_TIME_IN_HOURS,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'));
  SpreadsheetApp.flush();

  ui.alert('Time converted to hours',
    'Updated: ' + done.join(', ') + '\n\n' +
    'Column 9 now holds decimal hours — 2.5 means 2h 30m, and SUM() over the\n' +
    'column gives real hours. The dashboard still shows "2h 30m".\n\n' +
    'Point any KPI formula straight at the column; the old x24 correction must\n' +
    'be removed or the figures will be 24 times too big.',
    ui.ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// ID ALLOCATION
// ---------------------------------------------------------------------------

/**
 * Next free task number — always max + 1, never the bottom row.
 *
 * Duplicate-ID repairs renumber mid-sheet rows above the last row, and gap-fills
 * leave holes. The previous build threw whenever the bottom disagreed with the
 * maximum, which hard-blocked every submission for the entire window after the
 * 2026-09-03 repair (last row 2415, highest 2427).
 */
function getNextTaskNumber() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_SHEET_NAME);
  var lastRow = getRealLastRow(sheet);
  if (lastRow < 2) return 1;

  var ids = sheet.getRange(2, MASTER_COL_TASK_ID, lastRow - 1, 1).getValues();
  var maxNumber = 0, lastNumber = 0;

  for (var i = 0; i < ids.length; i++) {
    var m = String(ids[i][0]).trim().match(/^TASK-(\d+)$/);
    if (!m) continue;                    // skips malformed ids such as the bare "5"
    var n = parseInt(m[1], 10);
    if (n > maxNumber) maxNumber = n;
    lastNumber = n;                      // last VALID id, not "only if final row"
  }

  if (maxNumber === 0) {
    throw new Error('No valid TASK-<n> id found in Master column A. Check the sheet.');
  }
  if (lastNumber < maxNumber) {
    Logger.log('Sequence note: bottom row TASK-' + lastNumber +
               ', highest TASK-' + maxNumber + '. Allocating from the highest.');
  }
  return maxNumber + 1;
}

function formatTaskId_(n) { return 'TASK-' + String(n).padStart(3, '0'); }

// ---------------------------------------------------------------------------
// WEB APP
// ---------------------------------------------------------------------------

/**
 * ?page=mytasks  → personal dashboard, usable without opening the spreadsheet
 * anything else  → new task submission form
 */
function doGet(e) {
  var page  = (e && e.parameter && e.parameter.page) || 'submit';
  var file  = (page === 'mytasks') ? 'MyTasks' : 'Index';
  var title = (page === 'mytasks') ? 'My Tasks' : 'New Task Submission';

  return HtmlService.createTemplateFromFile(file)
    .evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Dropdown values pushed to the HTML, so the lists live in exactly one place. */
function getFormConfig() {
  return {
    // For the <select> elements: value = stored code, label = what people read.
    developers: labelled_(DEVELOPER_SHEET_NAMES, null),
    modules:    labelled_(ALLOWED.module,    LABELS.module),
    issueTypes: labelled_(ALLOWED.issueType, LABELS.issueType),
    priorities: labelled_(ALLOWED.priority,  LABELS.priority),
    planned:    labelled_(ALLOWED.planned,   LABELS.planned),
    // Bare codes for the AI prompt — it must emit values, never labels.
    raw: {
      modules:    ALLOWED.module,
      issueTypes: ALLOWED.issueType,
      priorities: ALLOWED.priority,
      planned:    ALLOWED.planned,
      developers: DEVELOPER_SHEET_NAMES
    },
    email:     currentEmail_(),
    devName:   currentDevName_(),
    isManager: isManager()
  };
}

// ---------------------------------------------------------------------------
// SINGLE TASK SUBMISSION
// ---------------------------------------------------------------------------

/**
 * Saving the task is the job. Attachments are an extra.
 *
 * Drive is therefore never touched unless something is actually being uploaded,
 * and a Drive failure downgrades to a warning on a saved task instead of
 * throwing the whole submission away. Reaching for the folder up front meant a
 * task with no attachments at all still died if the folder was unreachable.
 */
function handleImageSubmission(data) {
  var dropped = data.droppedFiles || [];
  var pasted  = data.pastedImages || [];
  var attachmentUrls = [], failedUploads = [], folderError = '';

  if (dropped.length || pasted.length) {
    var folder = null;
    try {
      folder = DriveApp.getFolderById(ATTACHMENT_FOLDER_ID);
    } catch (err) {
      folderError = 'The attachments folder could not be opened, so nothing was uploaded. ' +
                    'Ask Venul to share it with you, or paste links instead. (' + err.message + ')';
    }

    if (folder) {
      dropped.forEach(function (f) {
        var url = uploadBase64ToDrive_(f.data, f.name, folder);
        if (url) attachmentUrls.push(url); else failedUploads.push(f.name);
      });
      pasted.forEach(function (b64, i) {
        var name = 'Screenshot_' + (i + 1) + '_' + sanitizeFilename_(data.client) + '.png';
        var url = uploadBase64ToDrive_(b64, name, folder);
        if (url) attachmentUrls.push(url); else failedUploads.push(name);
      });
    } else {
      dropped.forEach(function (f) { failedUploads.push(f.name); });
      pasted.forEach(function (_, i) { failedUploads.push('Screenshot ' + (i + 1)); });
    }
  }

  var manual = data.attachmentText ? String(data.attachmentText).trim() : '';
  var links  = attachmentUrls.join('\n');
  if (manual) links = links ? links + '\n' + manual : manual;
  data.attachmentUrl = links;

  var result = processForm(data);

  if (result.success && (failedUploads.length || folderError)) {
    result.warning = 'Task saved. ' +
      (folderError || 'These attachments did not upload: ' + failedUploads.join(', ')) +
      (folderError && failedUploads.length ? ' Not uploaded: ' + failedUploads.join(', ') : '');
  }
  return result;
}

/**
 * Reports whether the signed-in user can actually write to the attachments
 * folder. With "Execute as: User accessing the web app" each person needs their
 * own access, so this is the first thing to check when uploads start failing.
 */
function checkAttachmentFolder() {
  var ui = SpreadsheetApp.getUi();
  try {
    var folder = DriveApp.getFolderById(ATTACHMENT_FOLDER_ID);
    var name = folder.getName();
    var probe = folder.createFile(Utilities.newBlob('ok', 'text/plain', '__access_probe.txt'));
    probe.setTrashed(true);
    ui.alert('Attachments folder OK\n\nFolder: ' + name + '\nId: ' + ATTACHMENT_FOLDER_ID +
             '\n\nYou can read and write it. Uploads will work for you.');
  } catch (e) {
    ui.alert('Attachments folder NOT reachable\n\nId: ' + ATTACHMENT_FOLDER_ID +
             '\n\n' + e.message +
             '\n\nUsual causes:\n' +
             '· the folder is not shared with this account (needs Editor)\n' +
             '· the folder was moved to the bin\n' +
             '· ATTACHMENT_FOLDER_ID in Code.gs is out of date\n\n' +
             'Tasks still save without attachments — only uploads are affected.');
  }
}

function uploadBase64ToDrive_(base64Data, fileName, folder) {
  try {
    var parts = String(base64Data).split(',');
    var mimeType = parts[0].match(/:(.*?);/)[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeType, fileName);
    var file = folder.createFile(blob);
    // Prefer domain-limited. Falls back to link-sharing on a consumer account.
    try {
      file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (domainErr) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    return file.getUrl();
  } catch (e) {
    Logger.log('Upload failed for ' + fileName + ': ' + e.message);
    return null;   // reported back to the user via failedUploads
  }
}

function sanitizeFilename_(name) {
  return name ? String(name).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') : 'File';
}

/**
 * Writes one task. Returns an OBJECT, never a bare string.
 * The old string return made every failure look like a success to
 * withSuccessHandler — the user saw a green tick and lost the form contents.
 */
function processForm(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, error: 'Server busy. Please try again.' };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);

    if (!formData.taskSummary || !String(formData.taskSummary).trim()) {
      return { success: false, error: 'Task summary is required.' };
    }

    var assignedMember = formData.assignedMember ? String(formData.assignedMember).trim() : 'Unassigned';
    if (DEVELOPER_SHEET_NAMES.indexOf(assignedMember) === -1) assignedMember = 'Unassigned';

    var taskId = formatTaskId_(getNextTaskNumber());
    var row = buildRow_(taskId, new Date(), currentEmail_(), assignedMember, formData);

    var targetRow = getRealLastRow(masterSheet) + 1;
    masterSheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();

    if (String(masterSheet.getRange(targetRow, 1).getValue()) !== taskId) {
      return { success: false, error: 'Write verification failed. Nothing was saved.' };
    }

    copyTaskToDevSheet_(ss, row, assignedMember);

    var devEmail = DEV_EMAILS[assignedMember];
    if (devEmail) sendAssignmentEmail_(formData, taskId, assignedMember, devEmail, ss.getUrl());

    return { success: true, taskId: taskId };
  } catch (error) {
    return { success: false, error: friendlyWriteError_(error) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * A strict dropdown on any task column makes setValues throw, and Sheets
 * reports it as a cell reference the submitter cannot act on. Name the real
 * cause instead.
 */
/**
 * Never throws. It runs inside a catch block, so a fault here escapes as a bare
 * TypeError, crosses google.script.run with no .message, and the user is told
 * "Task NOT saved: undefined" — which says nothing and hides the real cause.
 * That is exactly what an unguarded cell.match()[0] did.
 */
function friendlyWriteError_(error) {
  var msg;
  try {
    msg = (error && error.message) ? String(error.message) : String(error);
  } catch (e) {
    msg = 'Unknown error';
  }
  if (!msg || msg === 'undefined' || msg === 'null') msg = 'Unknown error';

  try {
    if (/data validation/i.test(msg)) {
      var cell = (msg.match(/cell\s+([A-Z]+\d+)/i) || [])[1] || '';
      var col  = (cell.match(/^[A-Z]+/) || [''])[0];
      var where = 'one of the columns';
      if (col) {
        var idx = 0;
        for (var i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64);
        where = '"' + (MASTER_HEADERS[idx - 1] || ('column ' + col)) + '"';
      }
      return 'The sheet is rejecting ' + where + ' because a dropdown on it is out of ' +
             'date — it does not list everyone on the team. Ask Venul to run ' +
             'Tracker Options > Admin > Refresh Dropdowns. Nothing was saved.\n\n' +
             'Sheets said: ' + msg;
    }
  } catch (e) {
    return msg;                     // fall back to the raw message rather than failing
  }
  return msg;
}

/** The one place that knows the 22-column row shape. */
function buildRow_(taskId, timestamp, submitterEmail, assignedMember, d) {
  return [
    taskId,
    timestamp,
    d.taskSummary || '',
    d.client || '',
    d.module || '',
    d.issueType || '',
    submitterEmail || '',
    assignedMember,
    '',                        //  9 approx time — filled by the timer
    d.deadlineDate || '',
    d.deadlineTime || '',
    '',                        // 12 completed date
    '',                        // 13 completed time
    'New',
    d.plannedUnplanned || '',
    d.priorityStatus || '',
    d.remarks || '',
    d.developerRemarks || '',  // 18 — now actually captured, was silently dropped
    '',                        // 19 start time
    d.reporter || '',
    d.attachmentUrl || '',
    'No'
  ];
}

function copyTaskToDevSheet_(ss, row, assignedMember) {
  if (DEVELOPER_SHEET_NAMES.indexOf(assignedMember) === -1) return false;
  var devSheet = ss.getSheetByName(assignedMember);
  if (!devSheet) return false;
  devSheet.getRange(getRealLastRow(devSheet) + 1, 1, 1, row.length).setValues([row]);
  return true;
}

function copyNewTaskToDevSheet(ss, row, assignedMember) {
  var ok = copyTaskToDevSheet_(ss, row, assignedMember);
  if (ok) SpreadsheetApp.flush();
  return ok;
}

// ---------------------------------------------------------------------------
// BULK IMPORT — the only sanctioned way to add many rows at once
// ---------------------------------------------------------------------------

function showBulkAddDialog() {
  var html = HtmlService.createTemplateFromFile('BulkAdd')
    .evaluate().setWidth(1000).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, 'Bulk Add Tasks');
}

/**
 * Parse and check a pasted block WITHOUT touching the sheet.
 * Returns a per-row verdict so the dialog renders a preview and refuses to
 * commit while any hard error is outstanding.
 */
function validateBulkRows(rawText) {
  var text = String(rawText || '')
    .replace(/^```[a-z]*\r?\n/i, '')
    .replace(/\r?\n```\s*$/, '');

  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });

  if (!lines.length) {
    return { rows: [], validCount: 0, errorCount: 0, error: 'Nothing pasted.' };
  }
  if (lines.length > BULK_MAX_ROWS) {
    return { rows: [], validCount: 0, errorCount: 0,
             error: 'Too many rows (' + lines.length + '). Maximum ' + BULK_MAX_ROWS + ' per batch.' };
  }

  // Drop a header line if the AI (or a copy from the sheet) included one.
  var hadHeader = /^\s*task\s*id\b/i.test(lines[0]);
  if (hadHeader) lines.shift();

  if (!lines.length) {
    return { rows: [], validCount: 0, errorCount: 0,
             error: hadHeader
               ? 'That is only the header row — there are no task lines under it. '
               + 'Paste the data rows, not the headings.'
               : 'Nothing to read.' };
  }

  var rows = [], validCount = 0, errorCount = 0;
  lines.forEach(function (line, i) {
    var parsed = parseBulkLine_(line, i + 1);
    rows.push(parsed);
    if (parsed.errors.length) errorCount++; else validCount++;
  });

  return { rows: rows, validCount: validCount, errorCount: errorCount };
}

function parseBulkLine_(line, lineNo) {
  var p = line.split('\t');
  var errors = [], warnings = [];

  function cell(i)     { return p[i] == null ? '' : String(p[i]).trim(); }
  function blankish(v) { return !v || /^(blank|n\/a|none|-)$/i.test(v); }

  if (p.length < 15) {
    return {
      lineNo: lineNo,
      errors: ['Only ' + p.length + ' columns — need at least 15. Check the AI used real tabs, not spaces.'],
      warnings: [], data: null, preview: line.slice(0, 120)
    };
  }

  function pick(value, list, label, required) {
    if (blankish(value)) {
      if (required) errors.push(label + ' is required.');
      return '';
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].toLowerCase() === value.toLowerCase()) return list[i];   // normalise case
    }
    errors.push('"' + value + '" is not a valid ' + label + '.');
    return value;
  }

  var summary = cell(2);
  if (!summary) errors.push('Task summary is required.');
  if (summary.length > 120) warnings.push('Summary is ' + summary.length + ' chars — aim under 60.');

  var client = cell(3);
  if (!client) errors.push('Client is required.');

  var assigned = cell(7);
  if (blankish(assigned)) {
    assigned = 'Unassigned';
    warnings.push('No assignee — defaulted to Unassigned.');
  } else if (DEVELOPER_SHEET_NAMES.indexOf(assigned) === -1) {
    if (ARCHIVED_DEVELOPER_SHEETS.indexOf(assigned) !== -1) {
      errors.push(assigned + ' has left the company. Reassign this row.');
    } else {
      errors.push('"' + assigned + '" is not a current team member.');
    }
  }

  var deadline = parseDateCell_(cell(9));
  if (!blankish(cell(9)) && !deadline) errors.push('Deadline date not understood: "' + cell(9) + '".');

  var deadlineTime = parseTimeCell_(cell(10));
  if (!blankish(cell(10)) && !deadlineTime) warnings.push('Deadline time not understood — left blank.');

  // Internal planning codes must never reach the management-facing columns.
  var banned = /\b(AC-\d+|V\d{2,}|D-C\d+|TD-\d+|B\d{3}|Q\d+|M\d{2}-C\d{2})\b/;
  if (banned.test(summary))  warnings.push('Summary contains an internal code — translate it to plain English.');
  if (banned.test(cell(16))) warnings.push('Remarks contain an internal code — translate it to plain English.');

  var data = {
    taskSummary:      summary,
    client:           client,
    module:           pick(cell(4),  ALLOWED.module,    'module',            true),
    issueType:        pick(cell(5),  ALLOWED.issueType, 'issue type',        false),
    assignedMember:   assigned,
    deadlineDate:     deadline || '',
    deadlineTime:     deadlineTime || '',
    plannedUnplanned: pick(cell(14), ALLOWED.planned,   'planned/unplanned', false),
    priorityStatus:   pick(cell(15), ALLOWED.priority,  'priority',          true),
    remarks:          cell(16),
    developerRemarks: cell(17),
    reporter:         cell(19)
  };

  return {
    lineNo: lineNo, errors: errors, warnings: warnings, data: data,
    preview: summary + '  ·  ' + client + '  →  ' + assigned
  };
}

function parseDateCell_(s) {
  s = String(s || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);          // yyyy-mm-dd
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);            // mm/dd/yyyy
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseTimeCell_(s) {
  s = String(s || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var ampm = m[3] ? m[3].toUpperCase() : null;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h > 23) return null;
  return String(h).padStart(2, '0') + ':' + m[2];
}

/**
 * Commit a validated batch.
 *
 * IDs are allocated once, sequentially, inside a single lock, and the whole
 * block lands in Master with ONE setValues call — a 50-row import costs one
 * write, not fifty, and cannot interleave with a concurrent form submission.
 */
function commitBulkRows(rawText) {
  var check = validateBulkRows(rawText);
  if (check.error) return { success: false, error: check.error };
  if (check.errorCount > 0) {
    return { success: false, error: check.errorCount + ' row(s) still have errors. Fix and re-validate.' };
  }
  if (!check.rows.length) return { success: false, error: 'Nothing to import.' };

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
  } catch (e) {
    return { success: false, error: 'Server busy. Try again in a moment.' };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);

    var nextNumber = getNextTaskNumber();
    var submitter  = currentEmail_();
    var now        = new Date();

    var rows = [], ids = [], byDev = {};
    check.rows.forEach(function (r) {
      var taskId = formatTaskId_(nextNumber++);
      var row = buildRow_(taskId, now, submitter, r.data.assignedMember, r.data);
      rows.push(row);
      ids.push(taskId);
      var dev = r.data.assignedMember;
      if (!byDev[dev]) byDev[dev] = [];
      byDev[dev].push(row);
    });

    var startRow = getRealLastRow(masterSheet) + 1;
    masterSheet.getRange(startRow, 1, rows.length, LAST_MASTER_COL).setValues(rows);
    SpreadsheetApp.flush();

    if (String(masterSheet.getRange(startRow, 1).getValue()) !== ids[0]) {
      return { success: false, error: 'Write verification failed. Check Master before retrying.' };
    }

    // One batched append per developer tab.
    var devErrors = [];
    Object.keys(byDev).forEach(function (dev) {
      var sheet = ss.getSheetByName(dev);
      if (!sheet) { devErrors.push('No tab named "' + dev + '"'); return; }
      var block = byDev[dev];
      sheet.getRange(getRealLastRow(sheet) + 1, 1, block.length, LAST_MASTER_COL).setValues(block);
    });
    SpreadsheetApp.flush();

    return {
      success: true, written: rows.length,
      firstId: ids[0], lastId: ids[ids.length - 1],
      devErrors: devErrors
    };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// SHEET PROTECTION & DROPDOWNS
// ---------------------------------------------------------------------------

/**
 * Lock the automated columns on every task sheet.
 * Status, Developer Remark and SVN Committed stay hand-editable so a developer
 * can still update from the sheet; everything else is script-owned.
 */
function applySheetProtection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  var keep = MANAGER_EMAILS.map(function (e) { return e.toLowerCase(); });
  keep.push(me);

  var done = [];
  allTaskSheetNames_().concat([MASTER_SHEET_NAME]).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
      if (p.getDescription() === PROTECTION_TAG && p.canEdit()) p.remove();
    });

    var protection = sheet.protect().setDescription(PROTECTION_TAG);
    var maxRows = sheet.getMaxRows();

    // Master is fully locked — it is written by the form and the bulk tool only.
    // Developer tabs keep the three editable columns open.
    if (name !== MASTER_SHEET_NAME) {
      protection.setUnprotectedRanges(SHEET_EDITABLE_COLUMNS.map(function (c) {
        return sheet.getRange(2, c, maxRows - 1, 1);
      }));
    }

    protection.getEditors().forEach(function (user) {
      var em = String(user.getEmail() || '');
      if (em && keep.indexOf(em.toLowerCase()) === -1) {
        try { protection.removeEditor(em); } catch (err) { /* owner cannot be removed */ }
      }
    });

    done.push(name);
  });

  applyDropdowns_(ss);

  SpreadsheetApp.getUi().alert(
    'Protection applied to ' + done.length + ' sheet(s).\n\n' +
    'Master: fully locked — add tasks through the form or Bulk Add.\n' +
    'Team tabs: Status, Developer Remark and SVN Committed stay editable.\n\n' +
    'Run Admin > Unlock Sheets to reverse this.'
  );
}

function removeSheetProtection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var count = 0;
  ss.getSheets().forEach(function (sheet) {
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
      if (p.getDescription() === PROTECTION_TAG && p.canEdit()) { p.remove(); count++; }
    });
  });
  SpreadsheetApp.getUi().alert('Removed ' + count + ' protection(s). Sheets are editable again.');
}

/** Dropdowns on the editable columns so hand-edits stay inside the allowed values. */
/**
 * Only these columns carry a dropdown. Every other task column is cleared.
 *
 * A strict rule (setAllowInvalid false) makes Apps Script THROW on setValues —
 * it does not quietly write through. So a stale rule anywhere in columns 1..23
 * blocks the whole row, and the user gets a raw Sheets error naming a cell.
 * That is what a leftover rule on column G (the submitter's EMAIL, listing
 * developer names) was doing.
 */
var VALIDATED_COLUMNS = { 8: 'assigned', 14: 'status', 22: 'svn' };

function applyDropdowns_(ss) {
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALLOWED.status, true).setAllowInvalid(false)
    .setHelpText('Pick a status from the list.').build();
  var svnRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ALLOWED.svn, true).setAllowInvalid(false).build();
  // Built from the live team list, so adding someone to DEVELOPER_SHEET_NAMES
  // and running this is all that is needed to let work be assigned to them.
  var assignedRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(DEVELOPER_SHEET_NAMES, true).setAllowInvalid(false)
    .setHelpText('Pick a current team member.').build();

  var cleared = 0, blocked = [];

  allTaskSheetNames_().concat([MASTER_SHEET_NAME]).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var rows = Math.max(sheet.getMaxRows() - 1, 1);

    // A Google Sheets Table makes its columns "typed" and rejects any validation
    // change, so each column is attempted on its own and a refusal is reported
    // rather than aborting the whole refresh.
    function attempt(col, fn) {
      try { fn(sheet.getRange(2, col, rows, 1)); return true; }
      catch (e) {
        if (/typed column|not allowed on cells/i.test(String(e.message))) {
          if (blocked.indexOf(name) === -1) blocked.push(name);
        } else { throw e; }
        return false;
      }
    }

    // Wipe every task column first, so no rule from an earlier setup survives.
    for (var c = 1; c <= SESSION_START_COL; c++) {
      if (VALIDATED_COLUMNS[c]) continue;
      var range = sheet.getRange(2, c, rows, 1);
      var has = false;
      try { has = !!range.getDataValidation() || range.getDataValidations().some(function (r) { return r[0]; }); }
      catch (e) { has = false; }
      if (has && attempt(c, function (r) { r.clearDataValidations(); })) cleared++;
    }

    attempt(SYNC_COLUMNS['Status'],        function (r) { r.setDataValidation(statusRule); });
    attempt(SYNC_COLUMNS['SVN Committed'], function (r) { r.setDataValidation(svnRule); });

    // Assignment is chosen on Master only; team tabs mirror whatever Master says.
    if (name === MASTER_SHEET_NAME) {
      attempt(MASTER_COL_ASSIGNED, function (r) { r.setDataValidation(assignedRule); });
    } else {
      attempt(MASTER_COL_ASSIGNED, function (r) { r.clearDataValidations(); });
    }
  });

  return { cleared: cleared, blocked: blocked };
}

/**
 * Lists every task column that carries a rule and what it allows.
 * Run this when a submission is rejected naming a cell — it shows which column
 * is objecting and whether the allowed values still match the team.
 */
/**
 * Works out where the data ACTUALLY sits, by what each column contains rather
 * than what its header claims.
 *
 * Repair Header Row only checked column A for TASK- ids, so a sheet whose data
 * was shifted from the middle onwards passed the guard and then had canonical
 * headings written over misplaced data — making the mismatch invisible instead
 * of fixing it. This is the tool that finds that.
 */
function diagnoseRowShift() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Fingerprints for the columns whose content is unmistakable.
  var expect = {
    1:  { name: 'Task ID',        test: function (v) { return /^TASK-\d+$/.test(String(v).trim()); } },
    7:  { name: 'Submitter email',test: function (v) { return /@/.test(String(v)); } },
    8:  { name: 'Assigned Member',test: function (v) { return allTaskSheetNames_().indexOf(String(v).trim()) !== -1; } },
    14: { name: 'Status',         test: function (v) { return ALLOWED.status.indexOf(String(v).trim()) !== -1; } },
    15: { name: 'Planned/Unplan', test: function (v) { return ALLOWED.planned.indexOf(String(v).trim()) !== -1; } },
    16: { name: 'Priority',       test: function (v) { return ALLOWED.priority.indexOf(String(v).trim()) !== -1; } },
    22: { name: 'SVN Committed',  test: function (v) { return ALLOWED.svn.indexOf(String(v).trim()) !== -1; } }
  };

  var report = [], verdicts = [];

  [MASTER_SHEET_NAME].concat(allTaskSheetNames_()).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var last = getRealLastRow(sheet);
    if (last < 2) return;

    var n = Math.min(30, last - 1);
    var data = sheet.getRange(2, 1, n, SESSION_START_COL).getValues();
    var lines = [], shifts = {};

    Object.keys(expect).forEach(function (colStr) {
      var col = parseInt(colStr, 10), spec = expect[col];

      // Where does this kind of value actually live? Scan nearby columns.
      var best = null, bestHits = 0;
      for (var c = Math.max(1, col - 3); c <= Math.min(SESSION_START_COL, col + 3); c++) {
        var hits = 0;
        for (var r = 0; r < n; r++) if (spec.test(data[r][c - 1])) hits++;
        if (hits > bestHits) { bestHits = hits; best = c; }
      }
      if (!bestHits) return;                       // column genuinely empty — no opinion

      if (best !== col) {
        var delta = best - col;
        shifts[delta] = (shifts[delta] || 0) + 1;
        lines.push('   ' + spec.name + ': expected ' + colLetter_(col) +
                   ', found in ' + colLetter_(best) + '  (' + bestHits + '/' + n + ' rows)');
      }
    });

    if (lines.length) {
      var worst = Object.keys(shifts).sort(function (a, b) { return shifts[b] - shifts[a]; })[0];
      verdicts.push(name + ' — data sits ' + Math.abs(worst) + ' column(s) ' +
                    (worst > 0 ? 'RIGHT' : 'LEFT') + ' of its headings');
      report.push(name + ':\n' + lines.join('\n'));
    }
  });

  if (!report.length) {
    ui.alert('Column check',
      'Every sheet holds the kind of data its headings promise. No shift found.',
      ui.ButtonSet.OK);
    return;
  }

  ui.alert('Columns do not match their headings',
    verdicts.join('\n') + '\n\n' + report.join('\n\n') +
    '\n\nDo NOT run Repair Header Row on these — it only rewrites headings and ' +
    'would hide the problem again.\n\n' +
    'The data has to be moved to match the headings, or the headings moved to ' +
    'match the data. Send me this report and I will tell you which.',
    ui.ButtonSet.OK);
}

function diagnoseValidation() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var headers = MASTER_HEADERS;
  var out = [], problems = [];

  [MASTER_SHEET_NAME].concat(allTaskSheetNames_()).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var probe = Math.min(getRealLastRow(sheet) + 1, sheet.getMaxRows());
    if (probe < 2) probe = 2;

    var lines = [];
    for (var c = 1; c <= SESSION_START_COL; c++) {
      var rule = sheet.getRange(probe, c).getDataValidation();
      if (!rule) continue;
      var vals = [];
      try { vals = rule.getCriteriaValues()[0] || []; } catch (e) {}
      var label = colLetter_(c) + ' ' + (headers[c - 1] || '?');
      lines.push('   ' + label + ' → ' + (vals.length ? vals.join(', ') : '(non-list rule)'));

      if (!VALIDATED_COLUMNS[c]) problems.push(name + ' ' + label + ' should have no rule');
      if (c === MASTER_COL_ASSIGNED && vals.length) {
        DEVELOPER_SHEET_NAMES.forEach(function (d) {
          if (vals.indexOf(d) === -1) problems.push(name + ' ' + label + ' is missing "' + d + '"');
        });
      }
    }
    if (lines.length) out.push(name + ':\n' + lines.join('\n'));
  });

  ui.alert('Data validation',
    (problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') +
       '\n\nRun Admin > Refresh Dropdowns to fix all of these.\n\n' : 'No problems found.\n\n') +
    (out.join('\n\n') || 'No validation rules anywhere.'),
    ui.ButtonSet.OK);
}

function applyDropdownsMenu() {
  var res = applyDropdowns_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert(
    'Dropdowns refreshed.\n\n' +
    'Assignable: ' + DEVELOPER_SHEET_NAMES.join(', ') + '\n' +
    'Status: ' + ALLOWED.status.join(', ') + '\n\n' +
    (res.cleared ? 'Cleared ' + res.cleared + ' stale rule(s) from columns that should not have one.'
                 : 'No stale rules found.') +
    (res.blocked.length
      ? '\n\nBLOCKED — these tabs are Google Sheets Tables, which refuse validation changes:\n  ' +
        res.blocked.join(', ') +
        '\n\nFix: click any cell in the table, open the table menu at its top-left ' +
        'corner (or right-click > Table), choose "Convert to range", then run this again.'
      : ''));
}

// ---------------------------------------------------------------------------
// TEAM TABS — creation and alignment
// ---------------------------------------------------------------------------

function colLetter_(n) {
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
  return s;
}

/**
 * Creates a team member's tab by COPYING Master's header row.
 *
 * Never type these headers by hand and never have an AI generate them from a
 * list you typed. Master is 23 columns; a list that is one short shifts every
 * column after the gap, and because onEdit reads header names from Master —
 * not from the tab being edited — the shift is silent and writes to the wrong
 * column instead of failing.
 */
function addTeamMemberTab() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!master) { ui.alert('Master sheet not found.'); return; }

  var resp = ui.prompt(
    'Add team member tab',
    'Type the name exactly as it appears in DEVELOPER_SHEET_NAMES (case sensitive).\n\n' +
    'Current list: ' + DEVELOPER_SHEET_NAMES.join(', '),
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var name = resp.getResponseText().trim();
  if (!name) return;

  if (DEVELOPER_SHEET_NAMES.indexOf(name) === -1) {
    ui.alert('"' + name + '" is not in DEVELOPER_SHEET_NAMES.\n\n' +
             'Add the name and their email to Code.gs first, save, reload the sheet, then run this again.');
    return;
  }
  if (ss.getSheetByName(name)) {
    ui.alert('A tab named "' + name + '" already exists.\n\n' +
             'Run Admin > Check Sheet Alignment to confirm its columns match Master.');
    return;
  }

  var sheet = ss.insertSheet(name);

  // Formatting comes from Master; the header TEXT comes from MASTER_HEADERS,
  // so a gap in Master's own heading row cannot propagate into the new tab.
  master.getRange(1, 1, 1, SESSION_START_COL)
        .copyTo(sheet.getRange(1, 1, 1, SESSION_START_COL), { formatOnly: true });

  try {
    sheet.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
  } catch (e) {
    ss.deleteSheet(sheet);
    ui.alert(tableErrorHelp_(e, name));
    return;
  }

  sheet.setFrozenRows(1);
  for (var c = 1; c <= SESSION_START_COL; c++) {
    sheet.setColumnWidth(c, master.getColumnWidth(c));
  }

  applyDropdowns_(ss);

  ui.alert('Created "' + name + '" with all ' + MASTER_HEADERS.length +
           ' headers (A to ' + colLetter_(MASTER_HEADERS.length) + ').\n\n' +
           'Dropdowns applied. Run Admin > Lock Sheets when you are ready to protect it.');
}

/**
 * Google Sheets "Tables" make their columns typed, and a typed column rejects
 * setValues outright. Turning a task tab into a Table breaks every write the
 * script makes, so say so in plain terms rather than surfacing the raw error.
 */
function tableErrorHelp_(e, sheetName) {
  var msg = String(e && e.message || e);
  if (/typed column|not allowed on cells/i.test(msg)) {
    return 'The "' + sheetName + '" tab is a Google Sheets Table, and Tables reject ' +
           'the writes this system makes.\n\n' +
           'Fix it: click any cell in the table, open the table menu (the icon at its ' +
           'top-left corner, or right-click > Table), and choose "Convert to range". ' +
           'Then run this again.\n\n' +
           'Never convert a task tab to a Table.\n\nOriginal error: ' + msg;
  }
  return 'Could not write headers to "' + sheetName + '".\n\n' + msg;
}

/**
 * Rewrites row 1 of Master and every task tab to the canonical headers.
 * Touches headings only — no data is moved. If a tab's DATA is shifted, the
 * headings will simply describe the wrong columns, so run Check Sheet Alignment
 * first and rebuild any tab it reports as shifted.
 */
/**
 * Column A must hold TASK-<n> ids. If it does not, the tab's data does not sit
 * where the headings claim, and rewriting the headings would paper over a real
 * shift rather than fix it. An empty tab is safe by definition.
 */
function looksShifted_(sheet) {
  var last = getRealLastRow(sheet);
  if (last < 2) return false;
  var n = Math.min(25, last - 1);
  var ids = sheet.getRange(2, 1, n, 1).getValues();
  var good = 0;
  for (var i = 0; i < ids.length; i++) {
    if (/^TASK-\d+$/.test(String(ids[i][0]).trim())) good++;
  }
  return good < Math.ceil(n * 0.6);
}

/**
 * Rewrites row 1 to the canonical headers — but only on tabs where doing so is
 * safe. Headings only; no data is ever moved.
 */
function repairHeaders() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var confirm = ui.alert('Repair header row',
    'Rewrites row 1 to the canonical ' + MASTER_HEADERS.length + ' headings.\n\n' +
    'Headings only — no data is moved.\n\n' +
    'Tabs whose column A does not hold TASK- ids are SKIPPED, because on those ' +
    'the data itself is shifted and correct headings would only hide it.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  var fixed = [], skipped = [], failed = [];

  [MASTER_SHEET_NAME].concat(allTaskSheetNames_()).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;

    if (looksShifted_(sheet)) {
      skipped.push(name + ' — column A does not hold task ids');
      return;
    }
    try {
      sheet.getRange(1, 1, 1, MASTER_HEADERS.length).setValues([MASTER_HEADERS]);
      sheet.setFrozenRows(1);
      fixed.push(name);
    } catch (e) {
      failed.push(name + ' — ' +
        (/typed column|not allowed on cells/i.test(String(e.message))
          ? 'is a Google Sheets Table. Convert it to a range first.'
          : e.message));
    }
  });
  SpreadsheetApp.flush();

  var msg = 'Repaired: ' + (fixed.join(', ') || 'nothing');
  if (skipped.length) msg += '\n\nSKIPPED (data is shifted — rebuild these by hand):\n  ' + skipped.join('\n  ');
  if (failed.length)  msg += '\n\nFAILED:\n  ' + failed.join('\n  ');
  msg += '\n\nRun Check Sheet Alignment again to confirm.';

  ui.alert('Repair header row', msg, ui.ButtonSet.OK);
}

/**
 * Compares every task tab's header row against Master, cell by cell.
 * Catches the exact failure a hand-built or AI-built tab produces: a missing
 * column that shifts everything after it.
 */
function verifySheetAlignment() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!master) { ui.alert('Master sheet not found.'); return; }

  // Checked against MASTER_HEADERS, not against Master's own row 1 — Master has
  // drifted too, so using it as the reference would bless its own gaps.
  var problems = [], missing = [], extras = [], ok = [];

  [MASTER_SHEET_NAME].concat(allTaskSheetNames_()).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) { missing.push(name); return; }

    var width = sheet.getLastColumn();
    var actual = sheet.getRange(1, 1, 1, MASTER_HEADERS.length).getValues()[0]
                      .map(function (h) { return String(h).trim(); });

    var diffs = [];
    for (var i = 0; i < MASTER_HEADERS.length; i++) {
      if (actual[i] !== MASTER_HEADERS[i]) {
        diffs.push('  ' + colLetter_(i + 1) + ': want "' + MASTER_HEADERS[i] +
                   '", got "' + (actual[i] || '(blank)') + '"');
      }
    }

    if (width > MASTER_HEADERS.length) {
      var tail = sheet.getRange(1, MASTER_HEADERS.length + 1, 1, width - MASTER_HEADERS.length)
                      .getValues()[0].filter(String);
      if (tail.length) extras.push(name + ': ' + tail.join(', '));
    }

    if (diffs.length) {
      problems.push(name + '  [' + width + ' cols]\n' + diffs.slice(0, 6).join('\n') +
                    (diffs.length > 6 ? '\n  ...and ' + (diffs.length - 6) + ' more' : ''));
    } else {
      ok.push(name);
    }
  });

  var msg = '';
  if (problems.length) msg += 'HEADERS WRONG:\n\n' + problems.join('\n\n') + '\n\n';
  if (missing.length)  msg += 'NO TAB YET: ' + missing.join(', ') +
                              '\nUse Admin > Add Team Member Tab.\n\n';
  if (extras.length)   msg += 'EXTRA COLUMNS past ' + colLetter_(MASTER_HEADERS.length) +
                              ' — the system ignores these, it does not clear them:\n  ' +
                              extras.join('\n  ') + '\n\n';
  msg += ok.length ? 'Correct: ' + ok.join(', ') : 'No correct sheets found.';

  if (problems.length) {
    msg += '\n\nIf only the HEADING TEXT is wrong, use Admin > Repair Header Row. ' +
           'If the DATA sits under the wrong headings, the tab is shifted — ' +
           'rebuild it with Add Team Member Tab and move the rows across by hand.';
  }

  ui.alert('Sheet alignment', msg, ui.ButtonSet.OK);
}

// ---------------------------------------------------------------------------
// STATUS LOGIC — shared by onEdit, the sidebar and the web dashboard
// ---------------------------------------------------------------------------

/**
 * Applies a status change to Master and the team tab together: starts the
 * clock, banks the elapsed session on pause/done, stamps completion.
 *
 * The running total is normalised through readStoredHours_ first. Duration cells
 * return a Date, and parseFloat(Date) is NaN — reading it raw would silently
 * reset the task's accumulated hours on every pause.
 */
function applyStatusChange_(masterSheet, masterRow, devSheet, devRow, newStatus, oldStatus) {
  var now = new Date();
  var hourMs = 60 * 60 * 1000;

  oldStatus = String(oldStatus == null ? '' : oldStatus).trim();
  newStatus = String(newStatus == null ? '' : newStatus).trim();
  if (!newStatus || newStatus === oldStatus) return;   // no transition, nothing to record

  function writeBoth(col, value) {
    masterSheet.getRange(masterRow, col).setValue(value);
    if (devSheet && devRow) devSheet.getRange(devRow, col).setValue(value);
  }
  function clearBoth(col) {
    masterSheet.getRange(masterRow, col).clearContent();
    if (devSheet && devRow) devSheet.getRange(devRow, col).clearContent();
  }

  writeBoth(SYNC_COLUMNS['Status'], newStatus);

  var wasRunning = (oldStatus === 'In Progress');

  // 1 · BANK FIRST. Leaving In Progress for ANY status closes the session.
  //     Banking only on Paused/Done/Blocked meant In Progress -> New silently
  //     discarded the session and left a stale timestamp behind.
  if (wasRunning) {
    var sessionStart = masterSheet.getRange(masterRow, SESSION_START_COL).getValue();
    if (!(sessionStart instanceof Date) && devSheet && devRow) {
      sessionStart = devSheet.getRange(devRow, SESSION_START_COL).getValue();
    }

    if (sessionStart instanceof Date) {
      var rawHrs = (now.getTime() - sessionStart.getTime()) / hourMs;
      var hrs = rawHrs, note = '';

      if (rawHrs < 0) {                       // clock skew or an edited timestamp
        hrs = 0;
        note = 'Session end was before its start (' + rawHrs.toFixed(1) + 'h). Logged 0.';
      } else if (rawHrs > MAX_SESSION_HOURS) {
        // Elapsed time is wall-clock: a timer left running overnight would log
        // 16h of "work". Cap it and leave a note rather than poison the KPI.
        hrs = MAX_SESSION_HOURS;
        note = 'Ran ' + rawHrs.toFixed(1) + 'h, capped at ' + MAX_SESSION_HOURS +
               'h. The timer was probably left running.';
      }

      var previous = readStoredHours_(masterSheet.getRange(masterRow, TOTAL_TIME_COL).getValue());
      writeBoth(TOTAL_TIME_COL, previous + hrs);
      clearBoth(SESSION_START_COL);

      if (note) {
        masterSheet.getRange(masterRow, TOTAL_TIME_COL)
          .setNote(note + '\n' + Utilities.formatDate(now, Session.getScriptTimeZone(),
                                                      'yyyy-MM-dd HH:mm'));
      }
    }
  }

  // 2 · Start a session only on a real transition INTO In Progress.
  //     Re-selecting In Progress while already running used to reset the start
  //     time and wipe everything accrued in that sitting.
  if (newStatus === 'In Progress' && !wasRunning) {
    writeBoth(SESSION_START_COL, now);
    if (!masterSheet.getRange(masterRow, START_TIME_COL).getValue()) {
      writeBoth(START_TIME_COL, now);       // first-ever start, never overwritten
    }
  }

  // 3 · Completion stamps. The original completion time is the KPI date, so it
  //     must not move when someone re-selects Done; and re-opening a task has
  //     to clear it, or the row counts as both finished and in flight.
  if (newStatus === 'Done') {
    if (!masterSheet.getRange(masterRow, SYNC_COLUMNS['Completed Date']).getValue()) {
      writeBoth(SYNC_COLUMNS['Completed Date'], now);
      writeBoth(SYNC_COLUMNS['Completed Time'], now);
    }
  } else if (oldStatus === 'Done') {
    clearBoth(SYNC_COLUMNS['Completed Date']);
    clearBoth(SYNC_COLUMNS['Completed Time']);
  }
}

// ---------------------------------------------------------------------------
// TRIGGERS
// ---------------------------------------------------------------------------

/** Team tab edits mirror up to Master. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();

  if (sheetName === MASTER_SHEET_NAME) return;
  if (DEVELOPER_SHEET_NAMES.indexOf(sheetName) === -1) return;

  var editedRow = e.range.getRow();
  var editedCol = e.range.getColumn();
  if (editedRow <= 1) return;
  // e.oldValue is undefined for multi-cell edits, which would corrupt the timer maths.
  if (e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;

  var masterSheet = e.source.getSheetByName(MASTER_SHEET_NAME);
  var headers = masterSheet.getRange(1, 1, 1, SESSION_START_COL).getValues()[0];
  var editedHeader = headers[editedCol - 1];

  var taskId = sheet.getRange(editedRow, MASTER_COL_TASK_ID).getValue();
  if (!taskId) return;
  var masterRow = findRowInSheet_(masterSheet, taskId);
  if (!masterRow) return;

  if (editedHeader === 'Status') {
    // Banking a session is read-modify-write on the running total. Without a
    // lock, two status changes landing together can lose one of the sessions.
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
    } catch (busy) {
      Logger.log('onEdit could not lock for ' + taskId + '; status written, time not banked.');
      masterSheet.getRange(masterRow, SYNC_COLUMNS['Status']).setValue(e.value);
      return;
    }
    try {
      applyStatusChange_(masterSheet, masterRow, sheet, editedRow, e.value, e.oldValue);
    } finally {
      lock.releaseLock();
    }
    return;
  }

  var col = SYNC_COLUMNS[editedHeader];
  if (col) masterSheet.getRange(masterRow, col).setValue(e.value == null ? '' : e.value);
}

/** Installable trigger on Master. Moves a task between team tabs on reassignment. */
function moveRowOnAssignment(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== MASTER_SHEET_NAME) return;
  if (e.range.getColumn() !== ASSIGNED_MEMBER_COL) return;
  if (e.range.getRow() <= 1) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  var row = e.range.getRow();
  var taskId = masterSheet.getRange(row, MASTER_COL_TASK_ID).getValue();
  if (!taskId) return;

  var rowData = masterSheet.getRange(row, 1, 1, LAST_MASTER_COL).getValues()[0];

  if (e.oldValue && DEVELOPER_SHEET_NAMES.indexOf(e.oldValue) !== -1) {
    deleteTaskFromDevSheet(e.oldValue, taskId);
  }
  if (e.value && DEVELOPER_SHEET_NAMES.indexOf(e.value) !== -1) {
    copyTaskToDevSheet_(ss, rowData, e.value);
    SpreadsheetApp.flush();
  }
}

function deleteTaskFromDevSheet(sheetName, taskId) {
  var devSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!devSheet) return;
  var row = findRowInSheet_(devSheet, taskId);
  if (row) { devSheet.deleteRow(row); SpreadsheetApp.flush(); }
}

function sendAssignmentEmail_(formData, taskId, assignedMember, devEmail, masterLogUrl) {
  var subject = 'NEW TASK ASSIGNED: ' + String(formData.taskSummary).slice(0, 70) + ' (' + taskId + ')';
  var body =
    '<html><body style="font-family:Arial,sans-serif">' +
      '<p>Hello <b>' + escapeHtml_(assignedMember) + '</b>,</p>' +
      '<p>A new task has been assigned to you.</p><hr>' +
      '<ul>' +
        '<li><b>Task ID:</b> '  + escapeHtml_(taskId) + '</li>' +
        '<li><b>Summary:</b> '  + escapeHtml_(formData.taskSummary) + '</li>' +
        '<li><b>Priority:</b> ' + escapeHtml_(formData.priorityStatus) + '</li>' +
        '<li><b>Deadline:</b> ' + escapeHtml_(formData.deadlineDate) + '</li>' +
      '</ul>' +
      '<p><b>Description:</b><br>' + escapeHtml_(formData.remarks) + '</p>' +
      '<p><a href="' + escapeHtml_(masterLogUrl) + '">Open the Master Log</a></p>' +
    '</body></html>';
  try {
    MailApp.sendEmail({ to: devEmail, subject: subject, htmlBody: body });
  } catch (e) {
    Logger.log('Assignment email failed: ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// DASHBOARD BACKEND
// ---------------------------------------------------------------------------

function getSidebarTasks(filters) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  var lastRow = getRealLastRow(masterSheet);
  var manager = isManager();
  var devName = manager ? null : currentDevName_();

  var payload = {
    tasks: [], isManager: manager, devName: devName,
    devNames: DEVELOPER_SHEET_NAMES.concat(ARCHIVED_DEVELOPER_SHEETS),
    webAppUrl: webAppUrl_()
  };
  if (lastRow < 2) return payload;
  if (!manager && !devName) {
    payload.notice = 'Your account is not mapped to a team tab. Ask Venul to add it.';
    return payload;
  }

  var includeFinished = !!(filters && filters.includeFinished);
  var data = masterSheet.getRange(2, 1, lastRow - 1, SESSION_START_COL).getValues();
  var now = new Date();
  var hourMs = 60 * 60 * 1000;
  var cutoff = now.getTime() - (DONE_WINDOW_DAYS * 24 * hourMs);
  var tasks = [], omittedOld = 0;

  // Walk newest first so the cap keeps recent work, not the 2025 backlog.
  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    if (!row[0]) continue;

    var assigned = String(row[7]).trim();
    if (!manager && assigned !== devName) continue;   // filter before building the object

    // Trimmed: a trailing space makes "Done " !== "Done", which used to give a
    // finished task a countdown chip.
    var status = String(row[13]).trim();

    if (status === 'Done' && !includeFinished) {
      var when = (row[11] instanceof Date) ? row[11]
               : (row[1] instanceof Date)  ? row[1] : null;
      if (!when || when.getTime() < cutoff) { omittedOld++; continue; }
    }
    if (tasks.length >= DASHBOARD_MAX_TASKS) { omittedOld++; continue; }

    var timeSpentHrs = readStoredHours_(row[8]);

    var sessionStart = row[SESSION_START_COL - 1];
    var isLive = (sessionStart instanceof Date) && status === 'In Progress';
    var idleHours = 0;
    if (isLive) {
      // Capped the same way a banked session is, so a timer left running since
      // last week shows 8h rather than 190h.
      var live = (now.getTime() - sessionStart.getTime()) / hourMs;
      timeSpentHrs += Math.max(0, Math.min(live, MAX_SESSION_HOURS));
      idleHours = idleHoursFor_(String(row[0]), sessionStart);
    }

    var deadlineDt = null, isOverdue = false, hoursRemaining = null, hoursOvertime = null;
    if (row[9] instanceof Date) {
      deadlineDt = new Date(row[9]);
      if (row[10] instanceof Date) deadlineDt.setHours(row[10].getHours(), row[10].getMinutes(), 0);
      else deadlineDt.setHours(23, 59, 59);
      var diff = deadlineDt.getTime() - now.getTime();
      if (status !== 'Done') {
        if (diff < 0) { isOverdue = true; hoursOvertime = Math.abs(diff) / hourMs; }
        else hoursRemaining = diff / hourMs;
      }
    }

    tasks.push({
      taskId: String(row[0]),
      date: (row[1] instanceof Date)
              ? Utilities.formatDate(row[1], Session.getScriptTimeZone(), 'MMM d')
              : '',   // formatDate throws on an invalid date, which used to kill the whole load
      summary: String(row[2]),
      client: String(row[3]),
      module: String(row[4]),
      submitter: String(row[6]),
      assignedMember: assigned,
      timeSpentHrs: timeSpentHrs,
      deadlineStr: deadlineDt ? Utilities.formatDate(deadlineDt, Session.getScriptTimeZone(), 'MMM d, HH:mm') : '',
      status: status,
      priority: String(row[15]),
      remarks: String(row[16]),
      devRemarks: String(row[17]),
      isOverdue: isOverdue,
      hoursRemaining: hoursRemaining,
      hoursOvertime: hoursOvertime,
      isLive: isLive,
      idleHours: idleHours,
      needsCheckIn: isLive && idleHours >= CHECKIN_IDLE_HOURS
    });
  }

  if (filters) {
    if (filters.developer && filters.developer !== 'all') {
      tasks = tasks.filter(function (t) { return t.assignedMember === filters.developer; });
    }
    if (filters.status && filters.status !== 'all') {
      tasks = (filters.status === 'overdue')
        ? tasks.filter(function (t) { return t.isOverdue; })
        : tasks.filter(function (t) { return t.status === filters.status; });
    }
    if (filters.search) {
      var q = String(filters.search).toLowerCase();
      tasks = tasks.filter(function (t) {
        return t.summary.toLowerCase().indexOf(q) !== -1 ||
               t.client.toLowerCase().indexOf(q)  !== -1 ||
               t.taskId.toLowerCase().indexOf(q)  !== -1;
      });
    }
  }

  tasks.sort(function (a, b) {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    var ar = typeof a.hoursRemaining === 'number', br = typeof b.hoursRemaining === 'number';
    if (ar && br) return a.hoursRemaining - b.hoursRemaining;
    if (ar !== br) return ar ? -1 : 1;
    return 0;
  });

  payload.tasks = tasks;
  payload.omittedOld = omittedOld;
  payload.includeFinished = includeFinished;
  return payload;
}

var PROP_WEBAPP_URL = 'WEB_APP_URL';

/**
 * Deployed web app URL for the "Open full page" link.
 *
 * ScriptApp.getService().getUrl() is only trustworthy when there is exactly one
 * deployment. With several it returns a stale id and the link lands on a Drive
 * "unable to open the file" page, so a saved value always wins.
 */
function webAppUrl_() {
  var saved = PropertiesService.getScriptProperties().getProperty(PROP_WEBAPP_URL);
  if (saved) return saved;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function setWebAppUrl() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var detected = '';
  try { detected = ScriptApp.getService().getUrl() || ''; } catch (e) {}

  var resp = ui.prompt('Set web app URL',
    'Paste the /exec URL from Deploy > Manage deployments — the one you have ' +
    'confirmed opens the form.\n\n' +
    'Saved:    ' + (props.getProperty(PROP_WEBAPP_URL) || '(none)') + '\n' +
    'Detected: ' + (detected || '(none)') + '\n\n' +
    'Leave blank and press OK to clear the saved value.',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var url = resp.getResponseText().trim().replace(/\?.*$/, '');
  if (!url) { props.deleteProperty(PROP_WEBAPP_URL); ui.alert('Cleared. Falling back to auto-detect.'); return; }
  if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
    ui.alert('That does not look right.\n\nExpected a URL ending in /exec, e.g.\n' +
             'https://script.google.com/macros/s/AKfy.../exec');
    return;
  }
  props.setProperty(PROP_WEBAPP_URL, url);
  ui.alert('Saved.\n\nMy Tasks page:\n' + url + '?page=mytasks');
}

/** Web dashboard entry point — same data, called from MyTasks.html. */
function getMyTasks(filters) { return getSidebarTasks(filters); }

function updateStatusFromSidebar(taskId, newStatus) {
  if (ALLOWED.status.indexOf(newStatus) === -1) {
    return { success: false, error: 'Unknown status: ' + newStatus };
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { success: false, error: 'Server busy' }; }
  try {
    return updateStatusUnlocked_(taskId, newStatus);
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/** Caller must already hold the script lock. */
function updateStatusUnlocked_(taskId, newStatus) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  var masterRow = findRowInSheet_(masterSheet, taskId);
  if (!masterRow) return { success: false, error: taskId + ' not found' };

  var assigned  = String(masterSheet.getRange(masterRow, MASTER_COL_ASSIGNED).getValue()).trim();
  var oldStatus = String(masterSheet.getRange(masterRow, SYNC_COLUMNS['Status']).getValue());
  var devSheet  = DEVELOPER_SHEET_NAMES.indexOf(assigned) !== -1 ? ss.getSheetByName(assigned) : null;
  var devRow    = devSheet ? findRowInSheet_(devSheet, taskId) : null;

  applyStatusChange_(masterSheet, masterRow, devSheet, devRow, newStatus, oldStatus);
  SpreadsheetApp.flush();
  return { success: true };
}

/** One lock for the whole batch — the old version locked and flushed per task. */
function bulkUpdateStatusFromSidebar(taskIds, newStatus) {
  if (ALLOWED.status.indexOf(newStatus) === -1) {
    return { success: false, error: 'Unknown status: ' + newStatus };
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { success: false, error: 'Server busy' }; }

  try {
    var updated = 0, errors = [];
    taskIds.forEach(function (id) {
      var r = updateStatusUnlocked_(id, newStatus);
      if (r.success) updated++; else errors.push(r.error);
    });
    SpreadsheetApp.flush();
    return { success: true, updated: updated, failed: errors.length, errors: errors.slice(0, 5) };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// CONVERSATION — comments, activity and the check-in nudge
//
// The Master sheet has no room for a thread, so comments live in their own tab:
//   1 Timestamp · 2 Task ID · 3 Author Email · 4 Author Name · 5 Kind · 6 Body
// Append-only. Nothing here ever edits Master except the minutes a post logs.
// ---------------------------------------------------------------------------

var COMMENT_HEADERS = ['Timestamp', 'Task ID', 'Author Email', 'Author Name', 'Kind', 'Body'];

function commentsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(COMMENTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(COMMENTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, COMMENT_HEADERS.length).setValues([COMMENT_HEADERS])
         .setBackground('#00712D').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150); sheet.setColumnWidth(2, 95);
    sheet.setColumnWidth(3, 210); sheet.setColumnWidth(4, 110);
    sheet.setColumnWidth(5, 80);  sheet.setColumnWidth(6, 620);
  }
  return sheet;
}

/** "Venul Minsara" -> "VM"; an email falls back to its first two letters. */
function initials_(name, email) {
  var src = String(name || '').trim() || String(email || '').split('@')[0];
  var parts = src.split(/[\s._-]+/).filter(String);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

function displayName_(email) {
  var e = String(email || '').toLowerCase();
  for (var name in DEV_EMAILS) if (String(DEV_EMAILS[name]).toLowerCase() === e) return name;
  return String(email || '').split('@')[0] || 'Someone';
}

function relativeWhen_(d) {
  var mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24)    return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 7)    return days + 'd ago';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/** Whole thread for one task, oldest first. */
function getTaskThread(taskId) {
  taskId = String(taskId || '').trim();
  if (!/^TASK-\d+$/.test(taskId)) return { comments: [] };

  var sheet = commentsSheet_();
  var last = getRealLastRow(sheet);
  if (last < 2) return { comments: [] };

  var rows = sheet.getRange(2, 1, last - 1, COMMENT_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).trim() !== taskId) continue;
    var when = rows[i][0] instanceof Date ? rows[i][0] : null;
    out.push({
      when:     when ? relativeWhen_(when) : '',
      stamp:    when ? when.getTime() : 0,
      email:    String(rows[i][2]),
      name:     String(rows[i][3]) || displayName_(rows[i][2]),
      initials: initials_(rows[i][3], rows[i][2]),
      kind:     String(rows[i][4] || 'comment'),
      body:     String(rows[i][5])
    });
  }
  out.sort(function (a, b) { return a.stamp - b.stamp; });
  return { comments: out };
}

/**
 * Posts an update. Also credits COMMENT_LOGS_MINUTES against the task, which is
 * what makes the thread worth using — a note is work, and it keeps the task off
 * the follow-up list.
 */
function addComment(taskId, body, alsoLogMinutes) {
  taskId = String(taskId || '').trim();
  body = String(body || '').trim();

  if (!/^TASK-\d+$/.test(taskId)) return { success: false, error: 'Unknown task: ' + taskId };
  if (!body) return { success: false, error: 'Write something first.' };
  if (body.length > 4000) return { success: false, error: 'Too long — keep it under 4000 characters.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { success: false, error: 'Server busy. Try again.' }; }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
    if (!findRowInSheet_(masterSheet, taskId)) return { success: false, error: taskId + ' is not in Master.' };

    var email = currentEmail_();
    var sheet = commentsSheet_();
    sheet.getRange(getRealLastRow(sheet) + 1, 1, 1, COMMENT_HEADERS.length)
         .setValues([[new Date(), taskId, email, displayName_(email), 'comment', body]]);

    var logged = 0;
    if (alsoLogMinutes !== false) {
      var row = findRowInSheet_(masterSheet, taskId);
      var previous = readStoredHours_(masterSheet.getRange(row, TOTAL_TIME_COL).getValue());
      masterSheet.getRange(row, TOTAL_TIME_COL).setValue(previous + (COMMENT_LOGS_MINUTES / 60));

      var assigned = String(masterSheet.getRange(row, MASTER_COL_ASSIGNED).getValue()).trim();
      if (DEVELOPER_SHEET_NAMES.indexOf(assigned) !== -1) {
        var dev = ss.getSheetByName(assigned);
        var devRow = dev ? findRowInSheet_(dev, taskId) : null;
        if (devRow) dev.getRange(devRow, TOTAL_TIME_COL).setValue(previous + (COMMENT_LOGS_MINUTES / 60));
      }
      logged = COMMENT_LOGS_MINUTES;
    }

    SpreadsheetApp.flush();
    return { success: true, loggedMinutes: logged, thread: getTaskThread(taskId).comments };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Hours since anything was recorded against a running task — the newest of its
 * last comment or the moment it started. Drives the check-in nudge, which only
 * has meaning because a real idle signal now exists.
 */
function idleHoursFor_(taskId, sessionStart) {
  var newest = (sessionStart instanceof Date) ? sessionStart.getTime() : 0;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMMENTS_SHEET_NAME);
  if (sheet) {
    var last = getRealLastRow(sheet);
    if (last >= 2) {
      var rows = sheet.getRange(2, 1, last - 1, 2).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][1]).trim() !== taskId) continue;
        if (rows[i][0] instanceof Date && rows[i][0].getTime() > newest) newest = rows[i][0].getTime();
      }
    }
  }
  if (!newest) return 0;
  return (Date.now() - newest) / (60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// MAINTENANCE
// ---------------------------------------------------------------------------

function syncMissingTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  var lastRow = getRealLastRow(masterSheet);
  if (lastRow <= 1) return;

  var entriesToCheck = 100;
  var startRow = Math.max(2, lastRow - (entriesToCheck - 1));
  var numRows  = lastRow - startRow + 1;
  var masterData = masterSheet.getRange(startRow, 1, numRows, LAST_MASTER_COL).getValues();

  var cache = {};
  DEVELOPER_SHEET_NAMES.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var dLast = getRealLastRow(sheet);
    cache[name] = dLast > 1
      ? sheet.getRange(2, MASTER_COL_TASK_ID, dLast - 1, 1).getValues().map(function (r) { return String(r[0]); })
      : [];
  });

  var pending = {};
  masterData.forEach(function (row) {
    var taskId = String(row[0]);
    var dev = String(row[ASSIGNED_MEMBER_COL - 1]).trim();
    if (DEVELOPER_SHEET_NAMES.indexOf(dev) === -1) return;
    if (!cache[dev] || cache[dev].indexOf(taskId) !== -1) return;
    if (!pending[dev]) pending[dev] = [];
    pending[dev].push(row);
    cache[dev].push(taskId);
  });

  var fixed = 0;
  Object.keys(pending).forEach(function (dev) {
    var sheet = ss.getSheetByName(dev);
    var block = pending[dev];
    sheet.getRange(getRealLastRow(sheet) + 1, 1, block.length, LAST_MASTER_COL).setValues(block);
    fixed += block.length;
  });
  SpreadsheetApp.flush();

  SpreadsheetApp.getUi().alert(
    'Audit complete. Checked last ' + numRows + ' tasks. Restored ' + fixed + ' missing row(s).'
  );
}

function populateSupportTracker() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SUPPORT_SHEET_NAME);
  if (!sheet) { SpreadsheetApp.getUi().alert('Sheet "' + SUPPORT_SHEET_NAME + '" not found.'); return; }

  if (sheet.getFilter()) sheet.getFilter().remove();
  var tasks = getSubmittedTasks();
  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), LAST_MASTER_COL).clearContent().clearFormat();

  var range = sheet.getRange(1, 1, tasks.length, tasks[0].length);
  range.setValues(tasks);
  sheet.getRange(1, 1, 1, tasks[0].length)
       .setBackground('#2d7d32').setFontColor('white').setFontWeight('bold');

  if (tasks.length > 1) {
    range.createFilter();
    sheet.autoResizeColumns(1, tasks[0].length);
  } else {
    sheet.getRange(2, 1).setValue('No tasks submitted by ' + currentEmail_());
  }
  sheet.activate();
}

function getSubmittedTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterSheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (!masterSheet) return [[]];

  var me = currentEmail_();
  var headers = masterSheet.getRange(1, 1, 1, LAST_MASTER_COL).getValues()[0];
  var lastRow = getRealLastRow(masterSheet);
  if (lastRow < 2) return [headers];

  var all = masterSheet.getRange(2, 1, lastRow - 1, LAST_MASTER_COL).getValues();
  var mine = all.filter(function (row) {
    return String(row[6]).toLowerCase().trim() === me;
  });
  return [headers].concat(mine);
}

// ---------------------------------------------------------------------------
// CLAUDE / ANTIGRAVITY WEBHOOK — secret lives in Script Properties, not source
// ---------------------------------------------------------------------------

var PROP_WEBHOOK_URL    = 'CLAUDE_WEBHOOK_URL';
var PROP_WEBHOOK_SECRET = 'CLAUDE_WEBHOOK_SECRET';

function setupClaudeWebhook() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var urlResp = ui.prompt('Webhook Setup (1 of 2)',
    'Paste the tunnel base URL — no path, no trailing slash.\n' +
    'Current: ' + (props.getProperty(PROP_WEBHOOK_URL) || '(not set)'),
    ui.ButtonSet.OK_CANCEL);
  if (urlResp.getSelectedButton() !== ui.Button.OK) return;

  var baseUrl = urlResp.getResponseText().trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s\/]+$/.test(baseUrl)) {
    ui.alert('That does not look like a base URL. Expected https://host with no path.');
    return;
  }

  var secretResp = ui.prompt('Webhook Setup (2 of 2)',
    'Paste the shared secret from .webhook-secret on the dev machine.\n' +
    'Currently ' + (props.getProperty(PROP_WEBHOOK_SECRET) ? 'set' : 'NOT set'),
    ui.ButtonSet.OK_CANCEL);
  if (secretResp.getSelectedButton() !== ui.Button.OK) return;

  var secret = secretResp.getResponseText().trim();
  if (!secret) { ui.alert('Secret cannot be empty.'); return; }

  props.setProperty(PROP_WEBHOOK_URL, baseUrl);
  props.setProperty(PROP_WEBHOOK_SECRET, secret);
  ui.alert('Saved. Use "Send Latest Task to Terminal" to test.');
}

function sendLatestTaskToClaude() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty(PROP_WEBHOOK_URL);
  var secret  = props.getProperty(PROP_WEBHOOK_SECRET);

  if (!baseUrl || !secret) {
    ui.alert('Webhook not configured.\n\nRun Admin > Configure Webhook first.');
    return;
  }

  var masterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_SHEET_NAME);
  var lastRow = getRealLastRow(masterSheet);
  if (lastRow < 2) { ui.alert('No tasks found in Master.'); return; }

  var latestTaskId = String(masterSheet.getRange(lastRow, MASTER_COL_TASK_ID).getValue()).trim();
  if (!/^TASK-\d{1,5}$/.test(latestTaskId)) {
    ui.alert('Row ' + lastRow + ' does not hold a valid Task ID (got "' + latestTaskId + '").');
    return;
  }

  try {
    var resp = UrlFetchApp.fetch(baseUrl + '/trigger-claude', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Webhook-Secret': secret, 'ngrok-skip-browser-warning': 'true' },
      payload: JSON.stringify({ taskId: latestTaskId }),
      muteHttpExceptions: true,
      followRedirects: false
    });
    var code = resp.getResponseCode();
    if (code === 200 || code === 202) {
      SpreadsheetApp.getActiveSpreadsheet().toast(latestTaskId + ' sent to local terminal.', 'Success', 5);
      return;
    }
    var detail = {
      401: 'Shared secret rejected. Re-run Configure Webhook.',
      400: 'The listener rejected "' + latestTaskId + '".',
      429: 'The listener is busy. Try again shortly.',
      404: 'Endpoint not found. Check the base URL has no trailing path.'
    }[code] || 'Unexpected response. Body: ' + resp.getContentText().slice(0, 300);
    ui.alert('Send failed (HTTP ' + code + ').\n\n' + detail);
  } catch (e) {
    ui.alert('Could not reach the listener.\n\nCheck the listener and tunnel are running.\n\n' + e.message);
  }
}

// ---------------------------------------------------------------------------
// MENU
// ---------------------------------------------------------------------------

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  var admin = ui.createMenu('Admin')
    .addItem('Add Team Member Tab', 'addTeamMemberTab')
    .addItem('Check Sheet Alignment', 'verifySheetAlignment')
    .addItem('Repair Header Row (headings only)', 'repairHeaders')
    .addItem('Check Attachments Folder', 'checkAttachmentFolder')
    .addItem('Diagnose Dropdowns', 'diagnoseValidation')
    .addItem('Check Column Alignment (data)', 'diagnoseRowShift')
    .addItem('Convert Time to Hours (once)', 'migrateTimeToHours')
    .addSeparator()
    .addItem('Lock Sheets (protect automated columns)', 'applySheetProtection')
    .addItem('Unlock Sheets', 'removeSheetProtection')
    .addItem('Refresh Dropdowns', 'applyDropdownsMenu')
    .addSeparator()
    .addItem('Set Web App URL', 'setWebAppUrl')
    .addItem('Configure Webhook', 'setupClaudeWebhook')
    .addItem('Send Latest Task to Terminal', 'sendLatestTaskToClaude');

  ui.createMenu('Tracker Options')
    .addItem('Open Task Dashboard', 'showSidebar')
    .addItem('Refresh My Submitted Tasks', 'populateSupportTracker')
    .addSeparator()
    .addItem('Bulk Add Tasks', 'showBulkAddDialog')
    .addItem('Sync Recent Tasks', 'syncMissingTasks')
    .addSeparator()
    .addSubMenu(admin)
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate().setTitle('Task Dashboard').setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}
