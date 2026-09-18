# UI/UX Standards — Prathap Valuation ERP

> AI loads this before any FE work. Non-compliance flagged as tech debt.
> For pending implementation backlog items, see: F:\MD FILES\Prompts\ui-standards-spec.md

---

## 1. Design System Basics

**Framework:** React 18 + Vite, PrimeReact component library
**Font:** System default (PrimeReact theme)
**Language:** English (Sri Lanka)
**Currency:** LKR — always prefix, comma-separated thousands, 2 decimal places (`LKR 1,234,567.89`)
**Date format:** `DD/MM/YYYY` display, ISO `YYYY-MM-DD` for API

---

## 2. Colour & Status System

| Intent | Class / Pattern | Use case |
|--------|----------------|----------|
| Primary action | `btn-primary` | Main CTA — Submit, Save, Create |
| Secondary action | `btn-secondary` | Cancel, Go Back, Keep Editing |
| Danger | `btn-danger` | Delete, Discard Changes |
| Success | `badge-success` / green | Active status, completed states |
| Warning | `badge-warning` / amber | On-hold, pending approval |
| Info | `badge-info` / blue | Draft, in-progress states |
| Neutral | `badge-secondary` / grey | Inactive, cancelled |

**Never use `btn-outline-primary` for a primary navigation or action button.**
Outline variants are for low-emphasis secondary actions only.

---

## 3. Button Hierarchy

Every form/modal/page has at most ONE primary (filled) button.
All others must be secondary or ghost.

```
[Cancel]  [Save Draft]  [Submit]
   ↑            ↑           ↑
secondary    secondary    primary
```

**Placement rules:**
- Wizard footers: Previous (left), Next/Submit (right), centred important actions use `flex: 1` spacers
- Modal footers: Cancel (left/secondary), Confirm (right/primary)
- Destructive confirmation: Keep Editing (secondary), Delete/Discard (danger)
- Never place a danger button on the left — always right

**Disabled state:**
- Disable primary button during API call (prevent double submit)
- Show a spinner inside the button while in-flight: `{loading ? <Spinner size="sm" /> : "Submit"}`

---

## 4. Forms

### Layout

- 2-column grid (`grid-cols-2`) for standard forms
- Full-width (span both columns) for: Name, Full Name, First Name, Last Name, Email, Address Line 1, Address Line 2, Property Address, any remark/notes field
- Required fields: red `*` after label using `.required` CSS class — **no exceptions**

### Validation

- Trigger: **on blur** (not on keyup, not only on submit)
- Show inline error **below** the input in red — not alert boxes, not toasts
- Also validate on submit — catch anything missed by blur
- Phone: numeric only, 7–15 digits, leading `+` allowed
- Email: must contain `@` and domain with `.`
- Currency inputs: numeric only, non-negative
- Required fields: show "This field is required" if empty on submit

### Submit flow

1. Validate all fields
2. If any invalid: show inline errors, scroll to first error, do not submit
3. If valid: disable submit button, show loading spinner in button
4. On success: show success toast, close modal or navigate
5. On failure: re-enable button, show error toast with message from API
6. Never swallow errors silently

### Dirty state

- Track if the user has changed any field: `const [isDirty, setIsDirty] = useState(false)`
- On cancel/close with dirty state: show confirm modal (NOT `window.confirm()`)
- Pattern: `showDiscardConfirm` state → modal with "Keep Editing" (secondary) + "Discard Changes" (danger)
- The X button on the modal must also go through the confirm flow — pass `onClose={handleCancel}` not `handleClose`

---

## 5. Tables

### Column order (always)

```
SearchKey | Name | [domain-specific columns] | Remark | Status | Actions
```

- Internal database IDs never shown in tables
- Default sort: alphanumeric ascending (A–Z) by SearchKey or Name — server-side preferred
- Currency columns: right-aligned, `LKR` prefix

### Pagination

- Default page size: 10 rows
- Show "Showing X–Y of Z records" footer
- Page size selector: [10, 25, 50] options

### Action column

- `Edit` (primary text button or icon)
- `Delete` (danger text button or icon) — always gated by confirmation modal
- Delete confirmation modal: Title "Confirm Delete", message "Are you sure you want to delete **[name]**? This cannot be undone.", buttons: Cancel | Delete (danger)

### Empty state

Table with no data must show a centred message:
```
No records found.
```
Never show an empty table body with no message.

### Loading state

Show a full-table skeleton or spinner while data is fetching. Never flash an empty state before data loads.

---

## 6. Modals

### Sizing

- Minimum size: `lg`
- Complex forms (many fields, sub-lists): `xl` or full-screen
- Confirmation dialogs only: `sm` or `md`

### Structure

```
┌─────────────────────────────────┐
│ Modal Title              [X]    │
├─────────────────────────────────┤
│ Form content                    │
│                                 │
├─────────────────────────────────┤
│ [Cancel]              [Submit]  │
└─────────────────────────────────┘
```

- Title: concise noun phrase — "Add Company", "Edit Contact Person"
- X button calls `handleCancel` (goes through dirty check) — not `handleClose` directly
- Footer buttons: Cancel left, primary action right
- Modal scroll: content area scrolls, header and footer are sticky

### Quick-add modals

For add modals launched from within another form (e.g. add applicant while creating assignment):
- Use same structure above
- On success: return the new record's ID to the parent and auto-select it in the parent form
- Do not navigate away — keep the parent form open

---

## 7. Dropdowns / Selects

- Always `SearchableSelect` — never plain `<select>` for non-trivial lists
- `creatable={true}` for fields where user may enter a value not in the list (free-text + pre-defined)
- Sort: alphanumeric ascending by label — server-side preferred
- Empty option: "Select..." placeholder — never empty string as default
- Clearable: all optional fields must have a clear (×) button
- Dropdown API pattern: `res.data` (plain array, not `res.data.data`)

---

## 8. Geography Fields

Any address collection uses structured fields:
`addressLine1`, `addressLine2`, `postalCode`, `countryId`, `provinceId` (regionId), `districtId`, `cityId`

**Never a free-text address string.**

Forward cascade: Country → Province → District → City (each clears children on change)
City always independently searchable — never disabled.
Reverse fill: if cityId known, call `GET /api/master/cities/{id}/geography` to fill parents.
See `R-FE-016` in `fe-rules.md` and `fe-incidents.md → Lesson-34-canon` for the full implementation pattern.

---

## 9. Toast Notifications

Use the app's `addToast()` hook. Never `window.alert()`.

| Situation | Type | Message pattern |
|-----------|------|----------------|
| Record created | success | "[Entity] created successfully" |
| Record updated | success | "[Entity] updated successfully" |
| Record deleted | success | "[Entity] deleted" |
| Validation failure | warning | "Please fill all required fields" |
| API error | error | API error message or "An error occurred. Please try again." |
| Background operation failed | warning | Brief description of what failed |

- Never show a success toast for an action that didn't complete
- Always show an error toast when an API call fails — no silent failures
- Toast duration: 3s for success/info, 5s for warning/error

---

## 10. Loading / Empty / Error States

Every data-fetching component must handle all three:

| State | What to show |
|-------|-------------|
| Loading | Spinner or skeleton — never blank |
| Empty (no records) | Centred "No records found." message |
| Error | Error toast + optionally an inline message — never crash |

Loading state must appear before the first data arrives — not after a blank flash.

---

## 11. Status Badges

Assignment workflow statuses displayed as coloured badges:

| Status | Colour |
|--------|--------|
| DRAFT | grey |
| NEW | blue |
| ASSIGNED | blue |
| INSPECTION | amber |
| INSPECTION_COMPLETED | amber |
| REPORTING | amber |
| PENDING_APPROVAL | amber |
| APPROVED | green |
| CHECKING | amber |
| CHECKING_COMPLETE | amber |
| READY_FOR_DISPATCH | green |
| PRINTED | green |
| DISPATCHED | green |
| COMPLETED | green |
| CANCELLED | red |
| ONHOLD | amber |
| RETURNED | red |

---

## 12. Navigation

- Active sidebar link: highlighted with primary colour
- Breadcrumbs on all inner pages (not dashboard)
- Back button on detail pages — always returns to the list, never `window.history.back()`
- "Under Development" banner: any page with UI but no working BE must show a prominent amber banner at top
- Remove the banner immediately when the BE is built and tested

---

## 13. Accessibility (Minimum Bar)

- All inputs must have a `<label>` with matching `htmlFor` — no placeholder-only labels
- Buttons must have descriptive text or `aria-label` — not just icons
- Error messages must be linked to the input via `aria-describedby`
- Tab order must be logical (top-left to bottom-right)
- No colour-only meaning — pair colour with text or icon

---

## 14. Forbidden Patterns

- `window.confirm()` — use `showDiscardConfirm` pattern
- `window.alert()` — use `addToast()`
- `console.log` left in committed code
- Plain `<select>` for non-trivial dropdowns
- Free-text address string fields
- Whole-file JSX rewrites — targeted edits only
- Success toast for a failed or non-functional action
- Under-development pages without a banner
- Status codes not on the approved list
