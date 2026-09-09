# First time you open the task form

You will see three or four Google screens before the form appears. **This is
normal.** It happens once per Google account, then never again.

The scary-looking warnings are because this is an internal tool built in-house,
not something published on the Google Marketplace. Google shows the same warning
for every private Apps Script in every company.

---

## The screens, in order

### 1 · "TaskSubmissionApp (Unverified)"

> TaskSubmissionApp needs your permission to access your data on Google.

Click **Review permissions**.

### 2 · Sign in to TaskSubmissionApp

Pick your **work account** — the one that has the task sheet shared with it.

> If you are signed into several Google accounts, this is where it goes wrong
> most often. Choose the wrong one and you will get a Drive error later.

Click **Continue**.

### 3 · "Google hasn't verified this app"

> The app is requesting access to sensitive info in your Google Account. Until
> the developer (office.venulm@gmail.com) verifies this app with Google, you
> shouldn't use it.

This is the one that scares people. The developer named is **Venul** — it is our
own tool.

Click **Advanced** (bottom left), then **Go to TaskSubmissionApp (unsafe)**.

The word "unsafe" is Google's blanket wording for any app it has not personally
reviewed. It is not a judgement about this app.

### 4 · "Select what TaskSubmissionApp can access"

Leave everything ticked and click **Continue** / **Allow**.

---

## What each permission is actually for

You should know what you are agreeing to. Every one of these is used by a
feature you will use:

| Permission | Why the tool needs it |
|---|---|
| See, edit, create, delete all of your Google **Drive** files | Saves the screenshots and PDFs you attach to a task, into the shared attachments folder |
| See, edit, create, delete all your Google **Sheets** | Reads and writes the task sheet itself |
| **Connect to an external service** | The webhook that sends a task to a developer's local AI terminal |
| **Send email as you** | The "new task assigned" notification to whoever the task goes to |
| Display and run third-party web content in prompts and sidebars | Draws the Task Dashboard sidebar and the Bulk Add window |

**Being straight about the Drive one:** it asks for *all* your Drive, not just
our folder. That is broader than we would like. It is how Google's Apps Script
Drive permission works when the script writes into a folder it did not create.
The script only ever touches the one attachments folder — but the permission
prompt cannot say that, so it asks for everything.

If that is not acceptable for your account, tell Venul. Attachments can be
turned off for the form, which removes the Drive permission entirely.

---

## After you have allowed it

The form loads and you will not see any of this again on that account.

Two links worth bookmarking:

| Page | URL |
|---|---|
| Submit a task | `<web app url>/exec` |
| My Tasks | `<web app url>/exec?page=mytasks` |

There are buttons between the two at the top of each page, so one bookmark is enough.

---

## If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Google Drive: "Sorry, unable to open the file at this time" | You are signed into a different Google account than the one the sheet is shared with, **or** the link is an old deployment | Sign out of the other accounts, or ask Venul for the current link |
| The page loads but is blank | Usually the same account problem | Open the link in an incognito window and sign in with the work account only |
| "You need permission" | The sheet has not been shared with you yet | Ask Venul |
| The form loads but Assign To is empty | Your account is not set up in the script yet | Ask Venul |

---

## Message to send a new joiner

> Opening the task form for the first time will show a few Google permission
> screens, including a red "Google hasn't verified this app" warning. That is
> expected — it is our own internal tool, built in-house, so Google has not
> reviewed it.
>
> On that screen click **Advanced**, then **Go to TaskSubmissionApp (unsafe)**,
> then **Allow**. It only happens once.
>
> Make sure you are signed into your work Google account and not a personal one,
> otherwise you will hit a Drive error afterwards.
>
> Any trouble, message me: office.venulm@gmail.com
