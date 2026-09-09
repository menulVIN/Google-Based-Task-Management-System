# Adding and removing team members

## Do not build a tab by typing the headers

Master is **23 columns**. A list that is one column short shifts everything
after the gap — and the shift is silent, because `onEdit` reads header names
from **Master's** row 1, not from the tab being edited. It writes to the wrong
column instead of failing.

This already happened. The Eshara tab was created from a 22-column list that
omitted **SVN Committed**, so its column V is labelled "Session Start" while the
code treats V as SVN Committed and W as the session clock.

The canonical 23:

| # | Header | # | Header |
|---|---|---|---|
| 1 | Task ID | 13 | Completed Time |
| 2 | Date | 14 | Status |
| 3 | Task Summary | 15 | Planned/Unplanned |
| 4 | Client | 16 | Priority Status |
| 5 | Module | 17 | Remarks |
| 6 | Issue Type | 18 | Developer Remark |
| 7 | Team Member (Submitting) | 19 | Start Time |
| 8 | Assigned Member | 20 | Reporting Client Name |
| 9 | Total Time Spent (Hrs) | 21 | Attachments |
| 10 | Deadline Date | 22 | **SVN Committed** ← the one that gets missed |
| 11 | Deadline Time | 23 | NA *(the session clock)* |
| 12 | Completed Date | | |

---

## The right way — three steps

### 1. Add them to the code

In `Code.gs`, two places:

```js
var DEV_EMAILS = {
  ...
  'Eshara': 'office.eshara@gmail.com',
  'Senura': 'office.senurav@gmail.com',
  ...
};

var DEVELOPER_SHEET_NAMES = [
  'Isura', 'Venul', 'Eshani', 'Janith', 'Eshara', 'Senura', 'Unassigned'
];
```

Save. Reload the spreadsheet so the menu rebuilds.

### 2. Create the tab from the menu

**Tracker Options → Admin → Add Team Member Tab**

Type the name exactly as it appears in `DEVELOPER_SHEET_NAMES` — it is case
sensitive and the tool refuses anything not in the list.

It copies Master's header row **verbatim**, including formatting, freezes row 1,
matches every column width, and applies the dropdowns. Nothing is typed, so
nothing can be miscounted.

### 3. Verify

**Tracker Options → Admin → Check Sheet Alignment**

Compares every tab's header row against Master cell by cell and names the exact
column where any tab diverges. Run it after any tab work, and any time sync
behaves oddly.

---

## If you want to use Gemini in Sheets anyway

Do not give Gemini a typed list of headers. Tell it to copy them:

> In this spreadsheet, copy the header row from the `Master` sheet — all
> columns from A to W — into row 1 of the `Eshara` sheet, preserving
> formatting. Do not retype the headers, do not reorder them, and do not omit
> any. Then freeze row 1 on `Eshara`.

Then run **Admin → Check Sheet Alignment** to confirm. Treat Gemini's own
"Verifying the Execution" summary as a claim, not proof — it reported success
on the 22-column version that was wrong.

**Do not let Gemini convert the range into a structured Table.** Apps Script
writes with `setValues` on plain ranges; a Table adds its own row handling and
was the cause of the earlier "Table header" errors in `populateSupportTracker`.

---

## Fixing the misaligned Eshara tab

While it holds no real task rows:

1. Right-click the `Eshara` tab → **Delete**.
2. **Tracker Options → Admin → Add Team Member Tab** → `Eshara`.
3. **Admin → Check Sheet Alignment** — confirm it reports Eshara as aligned.
4. **Tracker Options → Sync Recent Tasks** — pulls in any task already assigned
   to them in Master.

If it *does* hold rows, copy them out to a scratch sheet first, recreate the
tab, then paste the values back under the correct headers — checking that
SVN Committed and the session clock land in V and W respectively.

---

## Removing someone who has left

Move the name from `DEVELOPER_SHEET_NAMES` into `ARCHIVED_DEVELOPER_SHEETS`
and drop it from `DEV_EMAILS`:

```js
var DEVELOPER_SHEET_NAMES     = ['Isura', 'Venul', 'Eshani', 'Janith', 'Eshara', 'Senura', 'Unassigned'];
var ARCHIVED_DEVELOPER_SHEETS = ['Lahiru', 'Aditha', 'Udara', 'JanithP'];
```

**Never delete their tab.** Their history lives there, it stays filterable in
the dashboard, and Bulk Add will refuse to assign new work to them by name.

Then run **Admin → Refresh Dropdowns** so the Assigned column on Master stops
offering them.
