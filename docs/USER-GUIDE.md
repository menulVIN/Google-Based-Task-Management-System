# Task Tracker — how to use it

Built and maintained by Venul. Anything broken → **office.venulm@gmail.com**

> **Screenshots.** Every `[SCREENSHOT: …]` marker below is a slot waiting for a
> real picture of the live system. Take them once, drop them in `docs/img/`, and
> replace the marker with `![](img/<name>.png)`. I cannot capture them — they are
> of your Google account.

---

## 1. The one rule

**Nobody types a new task into the Master sheet.**

Master is written by the system, in one of two ways:

| You have | Use |
|---|---|
| One task | The **web form** |
| Several tasks from a work session | **Tracker Options → Bulk Add Tasks** |

Typing straight into Master is what produced twelve task IDs that each pointed
at two different pieces of work. When that happens, a developer changing their
own task's status silently overwrites someone else's row instead.

Everything except Status, Developer Remark and SVN Committed is locked. If a
cell refuses your edit, that is the protection doing its job — it is not broken.

---

## 2. Submitting one task

Open the web app link. Fill the form. Submit.

`[SCREENSHOT: the empty submission form]`

- Fields with a **red asterisk** are required.
- **Attachments** — drag files in, or click the box. Max 5 MB each. The Submit button greys out while files are still being read; wait for it.
- **Additional Links** — paste screenshots straight in with Ctrl+V, or paste links as text.
- You get a green message with the **task ID** when it saves.

**If it fails, it says so and keeps everything you typed.** A red message means
nothing was written. Fix what it names and press Submit again. It will never
tell you a task saved when it did not.

`[SCREENSHOT: a red failure message with the form still populated]`

---

## 3. Auto-fill — turning an AI session into a task

This is the point of the whole thing. You finish a piece of work in Antigravity
or Claude Code, and the session's notes become a task row without retyping.

**Step 1.** On the form, click **⚡ Auto-fill from AI** (top right), then **Copy AI Prompt**.

`[SCREENSHOT: the auto-fill panel open, with the two buttons]`

**Step 2.** Paste that prompt into your AI, and paste your raw session notes
where it says `[PASTE YOUR SESSION NOTES HERE]`.

**Step 3.** The AI replies with one long tab-separated line. Copy it.

**Step 4.** Paste it into the box in the auto-fill panel. The form fills itself.

`[SCREENSHOT: the form filled, fields outlined green]`

**Reading the result:**

| Colour | Meaning |
|---|---|
| Green outline | Accepted |
| Red outline | The AI produced something not in the dropdown — fix it by hand |
| No outline | Column was empty |

The message under the box lists every problem at once. **Your paste stays in the
box** if it fails, so you can see what actually arrived.

### The prompt writes itself

The prompt is generated from the live configuration, so the list of team members
and modules inside it always matches the dropdowns. When someone joins or
leaves, the prompt updates itself. Do not keep an old copy in a text file — copy
it fresh each time.

### Language rules the prompt enforces

Task Summary and Remarks are read by the COO, who does not know our internal
shorthand. The prompt bans planning codes — `AC-082`, `V64`, `D-C22.1`, `B305`,
`Q7` — and makes the AI translate them into what they actually do.

The one exception is **client comment numbers**, which come from the client's own
document. Spell those out: `(Client Comment 24)`, never `C24`.

Developer Remark is for you and the next developer. Real file names, tables,
endpoints and functions belong there. Planning codes still do not.

---

## 4. Bulk add — several tasks at once

**Tracker Options → Bulk Add Tasks.**

`[SCREENSHOT: the bulk add dialog, empty]`

Ask your AI for **one line per task**, newline separated, using the same prompt.
Paste the whole block.

**Press "Check rows" first.** Nothing is written yet. You get a verdict per row:

| Tag | Meaning |
|---|---|
| **Ready** | Will import as-is |
| **Warning** | Will import, but read the note — usually an internal code that slipped into the summary, or a missing assignee defaulted to Unassigned |
| **Blocked** | Will not import. Fix it |

`[SCREENSHOT: the preview table showing one Ready, one Warning and one Blocked row]`

**Import stays locked while any row is Blocked.** It is all-or-nothing, so you
never end up with half a batch in Master.

When it succeeds you get the ID range that was created — `TASK-2460 … TASK-2472`.

If you edit the box after checking, Import locks again and asks you to re-check.
That stops you importing something different from what you reviewed.

---

## 5. Working your tasks

Two ways in. Both show the same data and do the same thing.

### Inside the spreadsheet
**Tracker Options → Open Task Dashboard.**

### On the web — no spreadsheet needed
Add `?page=mytasks` to the web app URL.

**This is the one to use if you never open the sheet.** Same cards, same
buttons, wider layout.

`[SCREENSHOT: the My Tasks web page with a few task cards]`

### The cards

- **Colour bar on the left** — grey New, green Active, orange Paused, blue Done, red Overdue.
- **Top row of counters** — click any of them to filter.
- **Search** — matches summary, client or task ID.
- **Time chip** — total logged. A green dot means the clock is running right now, and it ticks while you watch.

### The three buttons

| Button | What happens |
|---|---|
| **Start** | Status → In Progress, clock starts |
| **Pause** | Clock stops, elapsed time is added to the total |
| **Done** | Clock stops, time banked, completion date and time stamped |

Time accumulates across sessions. Start / Pause / Start / Pause all day; the
total keeps adding up. It is never reset by pausing.

### Bulk

Tick several cards, then use the dark bar at the top to Start, Pause or Done all
of them at once.

---

## 6. Editing on the sheet — where you are matters

You can still work from the tabs. **What syncs depends entirely on which tab you
are standing on**, and this catches people out.

| You edit | What happens |
|---|---|
| **Your own tab** | Syncs up to Master. Status starts and stops the timer. Works as intended. |
| **Master** | Status changes **do not sync down and do not run the timer**. Only the Assigned column does anything — it moves the task to the new person's tab. |
| **Another person's tab** | Syncs to Master exactly as if it were yours. There is no ownership check. |
| **KPI, DB, Bug Count, any other tab** | Nothing. Ignored entirely. |

> **Change status on your own tab, or in the dashboard.** Doing it on Master
> looks like it worked — the cell changes — but no timer runs and the team tab
> still shows the old value.

The three columns you can edit by hand are **Status** (14), **Developer Remark**
(18) and **SVN Committed** (22). Status is a dropdown; pick from the list.
Every other column is locked because the system writes it.

**The dashboard ignores which tab you are on.** It always reads Master and
filters by your email, so opening it from someone else's tab still shows your
own tasks.

`[SCREENSHOT: the Status dropdown open on a team tab]`

---

## 7. For the two new joiners

Eshara and Senura — you have a tab each, and tasks get assigned to you like
anyone else.

**You do not need to open the spreadsheet at all.** Bookmark the web app URL
with `?page=mytasks` on the end. That page is your whole working surface:

1. See what is assigned to you
2. Press **Start** when you begin
3. Press **Pause** when you stop
4. Press **Done** when it is finished

To raise a task yourself, use **+ New task** in the top right.

Do not paste anything into the sheet directly. If you think a task's details are
wrong, say so rather than editing around it.

---

## 8. For managers

You see every task, plus a team filter next to the status filter.

### Tracker Options

| Menu item | Use |
|---|---|
| **Open Task Dashboard** | The sidebar |
| **Refresh My Submitted Tasks** | Rebuilds the Support Tracker tab with tasks you submitted |
| **Bulk Add Tasks** | Import a batch |
| **Sync Recent Tasks** | A task exists in Master but is missing from someone's tab — this restores it. Safe to run any time |

### Admin submenu

These change the sheet for everybody.

| Item | What it does |
|---|---|
| **Lock Sheets** | Protects Master completely. On team tabs, leaves only Status, Developer Remark and SVN Committed editable. Refreshes the dropdowns at the same time. |
| **Unlock Sheets** | Removes only the protections this script created. Anything you protected by hand is left alone. |
| **Refresh Dropdowns** | Re-applies Status, SVN and Assigned validation across every task sheet. Run after adding or removing someone. |
| **Configure Webhook** | Stores the tunnel URL and shared secret in Script Properties — never in the source, so a sheet viewer cannot read them. |
| **Send Latest Task to Terminal** | Pushes the newest task ID to your local listener so an IDE session can pick it up. |

> **Known gap.** The menu is visible to everyone who can open the sheet. Anyone
> can click **Unlock Sheets** and undo the protection, and anyone can edit
> anyone else's tab. There are no permission checks in the code — access is
> whatever Google Sheet sharing allows.

### Task numbering

IDs come from the **highest number that has ever existed**, not the bottom row
of the sheet. Those two disagree after a duplicate repair, and reading the
bottom row is exactly how the twelve duplicates were created.

Never reuse a gap. A gap is a deleted task, and something somewhere may still
reference that ID.

---

## 9. When something looks wrong

| Symptom | Cause | Fix |
|---|---|---|
| "Only N columns — need at least 15" | The AI used spaces instead of tabs | Ask it again for real tab characters |
| A dropdown field outlined red | The AI invented a value | Pick the right one by hand |
| Deadline is one day early | Should no longer happen — report it if it does | — |
| Task in Master, missing from a tab | A sync hiccup | **Tracker Options → Sync Recent Tasks** |
| A cell will not accept an edit | It is an automated column | Use the dashboard, or ask a manager to unlock |
| "No valid TASK-\<n\> id found" | Column A of Master is damaged | Stop. Tell Venul before submitting anything |
| Red message on submit | The task was **not** saved | Read what it says, fix, submit again — your text is still there |

---

## 10. Column reference

| # | Column | Written by |
|---|---|---|
| 1 | Task ID | System |
| 2 | Date | System |
| 3 | Task Summary | You |
| 4 | Client | You |
| 5 | Module | You |
| 6 | Issue Type | You |
| 7 | Submitter Email | System |
| 8 | Assigned Member | You (Master only) |
| 9 | Approx Time (Hrs) | **System — never type here** |
| 10 | Deadline Date | You |
| 11 | Deadline Time | You |
| 12 | Completed Date | **System** |
| 13 | Completed Time | **System** |
| 14 | Status | You — dropdown or dashboard |
| 15 | Planned / Unplanned | You |
| 16 | Priority | You |
| 17 | Remarks | You — plain business English |
| 18 | Developer Remark | You — technical detail |
| 19 | Start Time | **System** |
| 20 | Reporting Client Name | You |
| 21 | Attachments | System |
| 22 | SVN Committed | You |
| 23 | Session Start | **System — the live clock. Never touch** |

Bold rows are the ones that corrupt time tracking if you type over them. They
are locked once protection is applied.
