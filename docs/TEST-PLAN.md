# Test plan — run this before anyone else touches the system

Use a **throwaway Google account** as the test member. Do not test with your own
account: you are in `MANAGER_EMAILS`, so you see every task and every menu, and
you would never hit what a normal user hits.

## Setup

1. Create or borrow a spare Google account, e.g. `tracker.test@gmail.com`.
2. In `Code.gs`, add it as a temporary member:
   ```js
   'Tester': 'tracker.test@gmail.com',
   ```
   and put `'Tester'` in `DEVELOPER_SHEET_NAMES`. Save, reload.
3. **Admin → Add Team Member Tab** → `Tester`.
4. **Admin → Check Sheet Alignment** → must report Tester aligned.
5. Share the spreadsheet with the test account as **Editor**.
6. **Deploy → Manage deployments → New version → Deploy.** Copy the `/exec` URL.

Remove `Tester` from both lists when you finish, and archive or delete the tab.

---

## A · Alignment and setup

| # | Do | Expect |
|---|---|---|
| A1 | Admin → Check Sheet Alignment | Every active tab listed as aligned; Eshara/Senura flagged if not yet rebuilt |
| A2 | Admin → Refresh Dropdowns, then click a Status cell on a team tab | Dropdown offers New / In Progress / Paused / Done / Blocked |
| A3 | Click Assigned Member on Master | Offers only current members — no Lahiru, Aditha, Udara, JanithP |

## B · Single submission — as the test account

| # | Do | Expect |
|---|---|---|
| B1 | Open the `/exec` URL, submit a task assigned to Tester | Green message with a task ID |
| B2 | Check Master's bottom row | New row, Task ID one above the previous highest |
| B3 | Check the Tester tab | Same row mirrored |
| B4 | Check the test account's inbox | Assignment email, subject carries the task ID |
| B5 | Submit with Task Summary blank | Browser blocks it — field is required |
| B6 | Fill the form, then rename the Master tab and submit | **Red** message, form keeps everything you typed, nothing written. Rename Master back |

B6 is the one that matters. It proves a failure reports as a failure — the old
build showed a green tick and cleared the form.

## C · Auto-fill

| # | Do | Expect |
|---|---|---|
| C1 | Copy AI Prompt, read it | Lists only current members. No Lahiru, Aditha, Udara, JanithP |
| C2 | Paste a good 23-column line | Fields fill, green outlines, success message |
| C3 | Paste a line with `Bug-Fix` as issue type | That field outlined red, warning names it, everything else still fills |
| C4 | Paste a line with deadline `09/15/2026` | Deadline shows **2026-09-15**, not the 14th |
| C5 | Paste a line wrapped in ``` fences | Fences stripped, still fills |
| C6 | Paste 5 space-separated words | "Only N columns" error **and your text stays in the box** |
| C7 | Type a single letter into the box by hand | Nothing happens — no error, box not cleared |
| C8 | Submit an auto-filled task, check Master column R | Developer Remark actually saved |

C4 and C8 are the regressions. C4 was a day-early deadline; C8 was silently discarded.

## D · Bulk add

| # | Do | Expect |
|---|---|---|
| D1 | Bulk Add, paste 3 good lines, Check rows | 3 Ready, Import enabled |
| D2 | Import | ID range reported, 3 rows in Master, mirrored to the right tabs |
| D3 | Paste 3 lines with one assigned to `Udara`, Check | That row Blocked — "has left the company". Import disabled |
| D4 | Paste a line with `AC-082` in the summary, Check | Warning, not blocked |
| D5 | Paste a line with no assignee | Warning, defaults to Unassigned |
| D6 | Check rows, then edit the box, then Import | Refuses — asks you to check again |
| D7 | Paste a block with a header row on top | Header ignored, remaining rows parsed |

D3 and D6 are the safety rails. D6 stops you importing something other than
what you reviewed.

## E · Timer and status — as the test account

| # | Do | Expect |
|---|---|---|
| E1 | Dashboard → Start on a Tester task | Status In Progress, green dot, timer ticking |
| E2 | Wait 2 min → Pause | Roughly 2 min banked in Total Time Spent |
| E3 | Start → wait 1 min → Pause again | Total is now ~3 min. **Not reset to 1** |
| E4 | Done | Completed Date and Time stamped, time banked |
| E5 | On the Tester tab, change Status to In Progress by hand | Master updates too, timer starts |
| E6 | On **Master**, change a Status by hand | Master cell changes, team tab does **not**, no timer. Known and expected |
| E7 | Select 3 tasks, bulk Done | All three update in one go |

E3 is the regression check — reading the duration cell with `parseFloat` used to
wipe the accumulated total on every pause.

## F · Web dashboard — as the test account

| # | Do | Expect |
|---|---|---|
| F1 | Open `<exec-url>?page=mytasks` | Only Tester's tasks |
| F2 | Same page as your own account | Every task, plus the developer filter |
| F3 | Start / Pause / Done from the web page | Same behaviour as the sidebar |
| F4 | Narrow the browser to phone width | Single column, no sideways scroll, nothing clipped |
| F5 | Submit a task with a summary containing `"` and `<b>` | Card renders the characters literally, layout intact |

F5 is the escaping check. Those characters used to break the card outright.

## G · Protection

| # | Do | Expect |
|---|---|---|
| G1 | Admin → Lock Sheets | Confirmation naming the sheet count |
| G2 | As the test account, edit Status on the Tester tab | Allowed |
| G3 | As the test account, edit Developer Remark and SVN Committed | Allowed |
| G4 | As the test account, edit Task Summary on the Tester tab | Blocked |
| G5 | As the test account, edit anything on Master | Blocked |
| G6 | As the test account, open Tracker Options | **Admin submenu is visible.** Known gap — no permission checks |
| G7 | Admin → Unlock Sheets, retry G4 | Allowed again |

G6 is not a bug to report — it is the documented consequence of having no roles.
Decide whether you want it closed.

## H · Numbering

| # | Do | Expect |
|---|---|---|
| H1 | Note the highest Task ID, submit one | New ID = highest + 1 |
| H2 | Put `TASK-9999` in a mid-sheet Master row, submit | New ID = 10000. No error. Undo afterwards |
| H3 | Put `ABC` in Master's last column-A cell, submit | Still works — malformed IDs are skipped. Undo |

H2 is the fix for the tripwire that hard-blocked every submission after the
2026-09-03 duplicate repair.

---

## Record results

Copy this line per failure and send it over:

```
[test id] · what you did · what you expected · what actually happened
```
