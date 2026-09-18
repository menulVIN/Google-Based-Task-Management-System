# Standards — Emergent (Append-Only Queue)

> **Append-only.** New standards captured via the `STANDARD:` keyword land here first.
> **Drained weekly** by the Governor session — promoted to the proper standards file, then this file is cleared.
> Sessions read this file at open. Any rule here is active immediately.

**Format:**
```
## YYYY-MM-DD — [short-id]
Captured in: [which session]
Rule: [exact rule]
Reason: [why it matters]
```

---

## 2026-05-14 — async-loader-state
Captured in: Tester session (triggered by FE-6 fix on chunk 2026-05-13_quotation_revision)
Rule: Every async fetch or refresh action on the FE must have a dedicated loading boolean state and render a Loader component (or disabled/spinner state on the trigger button) while the call is in flight. A .catch() + addToast() alone is not sufficient — the user must see visual feedback during the request, not just on failure.
Reason: The refresh button had no loading indicator, causing a dead-click UX while the API was in flight. The fix added revisionsLoading state + Loader component. This pattern applies to all fetch/refresh actions, not just this one.

---

## 2026-05-15 — null-sub-resource-returns-404
Captured in: Planner session (Module 6 — Reference Number System, M6-C10 planning)
Rule: A GET endpoint that fetches a sub-resource by its parent's ID must return HTTP 404 with a `ResourceNotFoundException` (clear, distinct message) when the parent exists but the sub-resource field/link is null or empty. Never return 204 No Content for this case. Never return 200 + null body. Pair with R-BE-029: if the PARENT itself doesn't exist → 404 ("X not found: id"); if the parent exists but the SUB-RESOURCE is null/empty → also 404 with a separate message ("No Y linked to X: id"). Both paths throw `ResourceNotFoundException` so GlobalExceptionHandler renders a consistent error envelope, and FE handles both with a single `.catch()`.
Reason: Symmetric with R-BE-029. A null sub-resource is functionally a "resource doesn't exist" condition for the caller — they asked for something that isn't there. 404 with a clear message is more actionable than a silent 204. Keeps FE error handling uniform and removes a class of "what does empty mean here?" ambiguity. Established for `GET /v1/assignments/{id}/originating` and applies to every future sub-resource GET in the system.

- **STANDARD (BE):** When a status transition requires a field that is not persisted on the main entity (e.g., `pullBackReason` which only lives in logs), the `validateRequiredFields` and `isFieldPresent` methods in `AssignmentStatusService` must be passed the `TransitionRequest` to perform the validation.

---

## 2026-05-18 — duplicate-check-soft-deleted-carveout
Captured in: Planner session (Module 7 / Task 7.1 ruling by user)
Rule: R-BE-019 amended — Duplicate-check queries MUST include soft-deleted records (`isActive = false` included). Do NOT add an `isActive = true` filter to ANY of the three duplicate-check tiers (T1 composite, T2 plan+lot, T3 address FULLTEXT). Use dedicated repo methods named to make the carve-out explicit (e.g. `findByCompositeKeyIncludingInactive`, `findByPlanAndLotIncludingInactive`, `findByAddressFulltextIncludingInactive`). The existing `findAllForDuplicateCheck(clientId)` method (currently filters `isActive = true`) is superseded — Coder must delete it as part of M7-C01.
Reason: Composite property-key duplicate detection must catch ALL past valuations of a property, including ones that were soft-deleted in error. "Has anyone ever valued this property before?" — soft-deletion does not mean "never happened". The hard-rule "isActive = true only" in R-BE-019 was correct for the prior single-OR-of-fields check but is wrong for the new three-tier model. Carve-out applies ONLY to duplicate-check queries; every other read query in the system continues to default to `isActive = true`.

---

## 2026-06-08 — openapi-declare-before-mapstruct-or-silent-drop
Captured in: Architect (manual update from Gemini media-types session)
Rule: Any DB column/entity field exposed through the API MUST be declared in the `openapi.yaml` `*DTO` and `*Request` schemas BEFORE it will map. The generated DTO is built from the spec; if the property is absent, the generated class has no field, so MapStruct silently drops it on save and never returns it — **no compile-time error**. Add to openapi.yaml → regenerate (`mvn compile`) → restart. Concrete failure: Media Type `allowedExtensions` existed on table+entity but not in the spec, so admin edits "saved" in the UI but never persisted. Reinforces R-BE-037 (generated DTO canonical).
Reason: silent data loss with no error is the worst failure mode — looks saved, isn't. The spec is the contract; the entity is not enough.

---

## 2026-06-08 — flyway-migrations-not-auto-applied-on-live
Captured in: Architect (manual update from Gemini route_no session)
Rule: Flyway migrations (`db/seed/V*.sql`) are NOT auto-applied to the shared/live DB. A committed `V__*.sql` file does NOT mean the column exists in that environment. When a schema change ships: (1) run the migration DDL manually on each target DB, (2) restart the backend so Hibernate refreshes its schema-metadata cache. Any `Unknown column 'X'` / `SQLGrammarException` means the migration adding X wasn't applied there. A schema change is "done" only when committed AND applied to every environment AND the BE restarted. Concrete failure: V49 route_no committed but not applied → SLA scheduler crashed with `Unknown column 'assignment0_.route_no'` → 500s.
Reason: the gap between "migration written" and "migration applied" is invisible in code review and bites at runtime, often in a background scheduler far from the change.

---

## 2026-06-08 — geography-display-order-city-first
Captured in: Architect session (client request #10, AC-019)
Rule: Amends R-FE-016. The canonical DISPLAY order for every address form is **City → District → Province → Country** (most-specific first). City is the primary entry point: it is never disabled and MUST reverse-fill District/Province/Country via `geographyApi.getGeography(cityId)` (GET /master/cities/{cityId}/geography). Forward cascade (parent enables child) stays intact so bottom-up entry also works. No native `<select>` for geography — always SearchableSelect. Applies app-wide to all 8 address forms.
Reason: Sri Lankan users know their city; entering city-first and auto-filling upward is faster. A city-first visual order is only coherent if reverse-fill is wired — otherwise the top field fills nothing. So reverse-fill is now mandatory, not optional.

---

## 2026-06-08 — ac-chunk-numbering-find-max-by-folder
Captured in: Architect/Planner session (3rd numbering collision)
Rule: To find the next free AC-NNN (or M-XX-CXX) chunk number, glob the chunk FOLDER NAMES — `Glob **/AC-*` or list `docs/chunks/` — NOT `Glob **/AC-*/handoff.md`. Some chunks have only `walkthrough.md` + `test-log.md` and no handoff (e.g. May AC-035 reporting-stage-chained), so a handoff.md glob silently under-counts and you reassign a live number. Also check `docs/chunks/_deferred/`. State the verified max + next-free before writing any chunk.
Reason: Caused two collisions on 2026-06-08 — June batch mis-numbered AC-017..021 over existing May chunks, and pool reorder AC-035 collided with a handoff-less May AC-035. Renumber cleanup (→ AC-038..042) cost real time. Memory notes about "highest AC" go stale fast; always re-verify against the folder list.

---

## 2026-06-04 — audit-field-exposure-convention
Captured in: Architect session (M11 audit footer prerequisite)
Rule: Master DTOs expose audit fields as **flat strings/datetime**, not nested objects or raw IDs:
  ```yaml
  created:       { type: string, format: date-time }
  createdByName: { type: string }
  updated:       { type: string, format: date-time }
  updatedByName: { type: string }
  ```
  Server resolves user IDs to display names in the mapper via a shared `UserNameResolver` utility.
  FE receives display-ready strings — no `userMap` lookup needed.
  Transaction DTOs (Assignment, Quotation) may use `createdBy: $ref IdNameDTO` where FE needs the user ID — the convention split is intentional: **master = flat strings, transaction = IdNameDTO**.
Reason: R-FE-022 requires server-resolved display names. Master pages don't load user lists. Adding `createdBy: integer` would force every master page to make an extra API call for cosmetic display. The document DTO (openapi.yaml line 9186) already uses `createdByName: string` as precedent.

---

## 2026-06-04 — openapi-generated-dto-is-canonical
Captured in: Architect session (M11 CountryDTO collision investigation)
Rule: The **generated** DTO in `com.onesapro.valuation.dto.*` (from openapi.yaml) is the canonical DTO for all master entities. Hand-written DTOs in `dto/master/` are legacy dead code unless actively imported by a controller/service.
  Before editing any DTO: check whether it's generated (`target/generated-sources/openapi/`) or hand-written (`src/.../dto/master/`). If generated → edit openapi.yaml schema + regenerate. If hand-written AND actively imported → edit the Java class directly.
  Current live hand-written exception: `StatusSlaDTO` only.
  Dead code to delete: `dto/master/CountryDTO.java`, `dto/master/RegionDTO.java`, `dto/master/StatusDTO.java` — zero imports reference them.
Reason: CountryDTO existed in both `dto.master.CountryDTO` (hand-written) and `dto.CountryDTO` (generated). All services/mappers import the generated version. Editing the hand-written one achieves nothing. Planner was confused by the collision — this standard prevents recurrence.

---

## 2026-06-04 — user-name-resolver-utility
Captured in: Architect session (M11 audit footer prerequisite)
Rule: A shared `UserNameResolver` service must be created to resolve `Integer userId` → `String displayName` for audit fields. All master mappers inject this resolver and call it in `toDTO()` to populate `createdByName` / `updatedByName`. Returns `"System"` for null/unknown IDs.
  Do NOT inline user-lookup logic in individual mappers. Do NOT add a user repository dependency to every mapper — the resolver centralizes the lookup (with caching if needed later).
Reason: ~30+ master mappers need the same resolution. Without a shared utility, each mapper would independently query the user table — N+1 at the mapper layer.

---

## 2026-05-21 — architect-session-scope
Captured in: Architect session (M09/M10 close-out)
Rule: Architect session uses only Read and Grep tools. It produces AC-XXX handoff .md files. It does NOT run shell commands (ls, PowerShell, Bash), does NOT produce M-XX-CXX feature planning chunks (that is Planner's job), and does NOT write trailing status sentences ("Logged. Ready for X."). When asked to "decompose into chunks" — respond that this goes to Planner, not here.
Reason: Repeatedly violated in 2026-05-21 session — tried to run `ls` for migration version check and started heading into M10-CXX chunk decomposition. Both are out of scope.

---

## 2026-05-21 — m10-cheque-sub-status-mechanism
Captured in: Architect session (M10 verify pass doubt resolution)
Rule: Cheque clearance for M10 is a sub-status implemented as nullable columns on `sa_vp_assignment` — NOT a new status in `sa_vp_status` and NOT a separate `sa_vp_cheque_clearance` table. Columns: `cheque_bank_name`, `cheque_number`, `cheque_date`, `cheque_received_at`, `cheque_cleared_at`, `cheque_cleared_by_user_id`. Sub-status is derived: `chequePending = cheque_received_at IS NOT NULL AND cheque_cleared_at IS NULL`. Adding PENDING_CHEQUE_CLEARANCE as a full status would require amending R-FE-009 — do not do this without a formal standards amendment.
Reason: Only one cheque per assignment is realistic. A separate table adds surface area for no benefit. A new status requires R-FE-009 amendment which has not been approved.

---

## 2026-05-21 — m10-finance-gate-separation
Captured in: Architect session (M10 verify pass doubt resolution)
Rule: Two separate finance gates exist in the assignment lifecycle — do not merge them:
  1. **Payment Settled** (PENDING_CLEARANCE → PENDING_APPROVAL) — early lifecycle. Finance confirms payment received.
  2. **financeOk flag** (dispatch gate, near DISPATCHED) — late lifecycle. Finance clears the assignment for physical dispatch.
"Payment Settled" calls the generic `transitionStatus()`. `financeOk` is set via `POST /v1/assignments/{id}/finance-lock`. These are different business acts. Finance intentionally acts twice.
Reason: Merging them was Option B in the M10 doubt resolution and was explicitly rejected. The dispatch finance check protects a different concern (all paperwork + financial docs in order for dispatch) from the payment-settled check (has the client's payment cleared?).

---

## 2026-05-21 — m10-cheque-dispatch-block-scope
Captured in: Architect session (M10 verify pass doubt resolution)
Rule: When cheque clearance is pending (`chequePending = true`), block ALL transitions whose `targetStatus ∈ {READY_FOR_DISPATCH, PRINTED, DISPATCHED}`. The block is enforced at the service layer (`AssignmentStatusService.transitionStatus()`). Blocking only `CHECKING_COMPLETE → READY_FOR_DISPATCH` (Option A) is insufficient — it leaves bypass paths. Field inspection transitions (before APPROVED) are NOT blocked by cheque status.
Reason: Defence in depth. Brief stated "all transitions toward READY_FOR_DISPATCH are hard-blocked."

---

## 2026-05-21 — duplicate-check-three-tier-contract
Captured in: Planner session (Module 7 / Task 7.1 ruling by user)
Rule: Assignment duplicate detection is a three-tier model with fixed semantics and UI treatments:
  - **T1 — Plan No + Lot No + Surveyor (all 3 match):** near-certain duplicate. Triggers Task 7.3 full-screen red interstitial; operator must type `CONFIRM` to proceed.
  - **T2 — Plan No + Lot No (surveyor absent or different):** strong candidate. Triggers the existing-style blocking warning modal with links to matches; "Proceed Anyway" + secondary confirm.
  - **T3 — Address only (no plan/lot match):** weak signal. Renders an inline soft banner under the address field; never blocks save.
Evaluation rule: T1 evaluated first. If T1 non-empty, do NOT also surface T2 (T1 is a strict superset). Fall through to T2 only if T1 is empty. T3 ALWAYS runs independently — a T3 match may show alongside a T1 or T2 hit (different old record, address coincidence) and must not be suppressed.
Service contract: single method `DuplicateCheckResult checkDuplicates(DuplicateCheckRequest)` returning `record DuplicateCheckResult(List<AssignmentSummary> tier1Matches, List<AssignmentSummary> tier2Matches, List<AssignmentSummary> tier3Matches) {}`. Two SQL queries: (a) composite-key by (planNo, lotNo, surveyorId) — classified into T1 or T2 in Java by checking surveyor match; (b) address FULLTEXT — feeds T3.
DB indexes (in V<next>__duplicate_check_indexes.sql):
  - `CREATE INDEX idx_dup_plan_lot_surveyor ON sa_vp_assignment (survey_plan_no, lot_no, land_surveyor_id)` — serves T1 and T2 via left-prefix.
  - `CREATE FULLTEXT INDEX ft_property_address ON sa_vp_assignment (property_address)` — serves T3.
FE behaviour: render order in NewAssignment intake — `if (tier1Matches.length) <CompositeKeyDuplicateInterstitial />` else `if (tier2Matches.length) <DuplicateWarningModal />`; T3 banner renders independently whenever `tier3Matches.length > 0`.
Reason: Replaces the prior single OR-of-fields duplicate check. Each tier has a distinct cost of being wrong: T1 wrong = wasted valuer visit to a property already valued months ago (worst); T2 wrong = needs confirmation; T3 wrong = informational. Pairing match strength with UI prominence prevents both false alarms and missed catches. Contract documented here verbatim so every Coder handoff for Module 7 inherits the same semantics.

---

## 2026-05-22 — institution-scoped-thresholds
Captured in: Planner session (M12 verify pass — TASK 11.5)
Rule: Fee approval thresholds and delegation caps must be scoped to institution_id or to the delegation record itself, never to a standing user-level cap table. If a threshold or cap table is ever needed, key it by sa_institution_id only. The existing sa_vp_credit_limit is the canonical pattern. MdDelegation.amount_cap_lkr (added in M12) is the correct form for per-delegation caps — it lives on the delegation record (temporary window), not a permanent user-level table.
Reason: Meeting note N21: "user delegation is not needed just institution." Prevents a pattern where approval authority scales by user rather than by institution credit standing.

---

## 2026-05-22 — page-heading-h1-no-icon
Captured in: Architect session (bug triage — fixes #8, #9 from JanithP audit)
Rule: The page-level heading (current convention: `<h3>` at top of every page in `src/pages/`) renders TEXT ONLY. No icon prefix, no emoji, no badge, no decoration. Icons remain valid on section headers (sub-titles within the page), action buttons, and inline list rows. When restyling or adding a new page, the topmost heading must be plain text. Step 9-style demotions (h3 → h4 for internal section headers) are still required to preserve semantic hierarchy when a section header would otherwise collide with the page title.
Reason: Visual inconsistency observed across Proforma Invoices, Quotation Call Back Pool, and others. An icon on the page title pushes the user's eye sideways and competes with section sub-headers that DO carry icons. Calm anchor at top-of-page, decorative iconography reserved for navigation/action contexts. Captured to unblock the icon-strip pass and prevent re-introduction.

---

## 2026-05-22 — production-logger-wrapper
Captured in: Architect session (bug triage — answers #28 from code audit)
Rule: Production code must NOT use raw `console.log()` or `console.warn()`. A shared `src/utils/logger.js` wrapper provides `logger.debug(...)` and `logger.warn(...)` that are GATED on `import.meta.env.PROD` — no-op in production builds, pass-through to console in dev. The wrapper is added in its own Coder pass, plus a one-shot codemod that replaces every `console.log` with `logger.debug` and every `console.warn` with `logger.warn` across `src/`. `console.error` is RETAINED as-is everywhere — real errors must surface in browser DevTools in all environments including production.
Reason: 162+ `console.log` calls were found in the codebase audit. They leak internal state, clutter user DevTools, and run cost in prod for no benefit. A wrapper preserves the dev experience without the prod cost. Preserving `console.error` keeps real errors visible for support and debugability.

---

## 2026-06-02 � nested-list-fallback-filter
Captured in: Coder session (AC-022)
Rule: If a backend endpoint requires a parent ID (e.g. categoryId) but the frontend page was designed as a flat list, introduce a parent filter dropdown defaulting to the first available parent, rather than making multiple API calls or leaving the page broken.
Reason: Keeps the UI functional with the current backend contract while avoiding N+1 API calls.

---

## 2026-06-04 — approval-threshold-scope-split  (SUPERSEDES 2026-05-22 institution-scoped-thresholds)
Captured in: Planner session (Module 11 — Task 11.5 user ruling 2026-06-04)
Rule: Approval-threshold scope is SPLIT by type — NOT unified to "institution-only" as the M11 brief originally implied and as the prior 2026-05-22 `institution-scoped-thresholds` standard stated. That prior standard is hereby superseded. The correct, finer-grained rule:
  (a) **Credit limit** (`sa_vp_credit_limit`) — institution-scoped, keyed by `sa_institution_id`. Answers "how much can this institution be charged before they hit a credit hold?"
  (b) **Fee config** (`sa_vp_fee_config`) — institution-scoped, joined to valuation type / purpose. Answers "what is the calculated fee for this work?"
  (c) **Fee approval threshold (per approver)** — USER-BASED, captured EXCLUSIVELY via `sa_vp_md_delegation.amount_cap_lkr`. Answers "how much can this approver (acting as MD delegate) approve up to?" The cap lives on the delegation row, not a parallel `fee_approval_threshold` / `user_cap` / `approval_cap` table.
There is NO separate `fee_approval_threshold` table and one SHALL NOT be created. Any future brief proposing such a table must be rejected — the cap is already first-class on the delegation row (added in M12-C03 v2).
Reason: User ruling 2026-06-04 corrected the M11 brief (Task 11.5 / N21) which originally read "thresholds are institution-scoped, no user-level cap." Two distinct scopes were conflated. Institutional thresholds (credit, fee config) ARE correctly institution-scoped — those apply to "the institution as a customer." The fee-approval cap is intrinsically PER-APPROVER — it varies per delegation pair (which delegate, granted by which MD, for which window, up to what amount). M12-C03 v2 already shipped this as `amount_cap_lkr` on `sa_vp_md_delegation` (BigDecimal, precision 15 scale 2). This standard formalises: that field IS the user-scoped approval threshold and the only place a per-approver cap lives.

---

## 2026-06-18 — sql-safe-updates-compatibility
Captured in: Coder session (during AC-051 implementation)
Rule: All UPDATE and DELETE queries in SQL migrations and seed scripts must be safe-mode-compliant by including a WHERE clause that references a key column (e.g., adding `AND primary_key_column > 0` or similar primary key checks) to bypass MySQL safe update mode (Error 1175) without requiring users to disable safe update mode in their SQL client.
Reason: Prevent Error 1175 when developers run migrations/seeds manually in MySQL Workbench or other database clients that enforce safe updates by default.

## 2026-07-09 — canonical-status-list-gains-draft-issued
Captured in: War-room session (Fable 5) — client-comment C20 decisions, locked by Venul
Rule: The canonical assignment status list gains **DRAFT_ISSUED** (sits between APPROVED and CHECKING; edges APPROVED→DRAFT_ISSUED→CHECKING; the direct APPROVED→CHECKING edge is KEPT so the draft step is optional). Display renames locked: RETURNED displays as "Reject"; INSPECTION displays as "In Inspection"; DRAFT_ISSUED displays as "Draft Issued" — never "Draft", which remains the wizard DRAFT status's name. "Pending Doc" is a HOLD TYPE (ONHOLD with reason "Awaiting Documents"), NOT a status. Until the Governor drains this: any validation list containing the fixed status codes (code-standards.md §Cross-Cutting Naming, R-FE-009 family, FE `stateMachine.js` / `ASSIGNMENT_STATUS`) must treat DRAFT_ISSUED as VALID once backlog B305 ships — do not flag it as an unknown status.
Reason: C20 client decisions (2026-07-09, decisions file in docs/client-comments/). The 18-value list would otherwise cause agents to reject the new status as a standards violation — a stale rule masquerading as a guardrail. Governor: on drain, update code-standards.md naming list + fe-rules status list, and note the two-drafts naming hazard (wizard DRAFT vs DRAFT_ISSUED) for the APPLICATION-GUIDE.

---

## 2026-07-15 — v-file-statement-idempotency
Captured in: Planner/war-room session (V60 double-run incident)
Rule: EVERY statement in a `V*.sql` migration must be individually re-run-safe — including UPDATEs, not just INSERTs. An UPDATE that supports an INSERT (e.g. a sortOrder shift making room for a new row) must be guarded by the SAME existence condition as that INSERT (`AND NOT EXISTS (SELECT 1 FROM (SELECT 1 FROM <table> WHERE searchKey='<new-key>') x)` — the derived-table wrapper is mandatory in MySQL when the subquery targets the UPDATE's own table). Conditional DDL uses the information_schema + PREPARE pattern — never `DELIMITER`/stored procedures (not Flyway-replayable). Extends `2026-06-18 — sql-safe-updates-compatibility` (that one makes statements safe-MODE-compliant; this one makes them re-RUN-safe).
Reason: V60 was executed twice against live; every guarded statement survived unharmed, but the unguarded sortOrder UPDATE ran twice and shifted all statuses ≥11 by +2 (cosmetic, but permanent drift). The guard gap is exactly what file review catches — this standard makes it a checkable rule rather than reviewer memory.

---

## 2026-07-15 — single-live-tracker-close-out
Captured in: Planner/war-room session (tracker system installation)
Rule: `docs/TRACKER.md` is the single live status board (chunk states / migration ledger Written-Reviewed-Applied / numbering waterlines / test queue). Every state change updates it in the SAME session — it is STEP 8 of document-after-change.md. The folder-prefix rename (`[C]_`/`[C_T]_`) and the tracker update travel together; one without the other is an incomplete close-out. Folder prefixes remain physical ground truth — on disagreement the folder wins, the tracker gets fixed, and a MISTAKE goes to the queue. Migration gate rides the ledger: Coder ticks Written, Planner ticks Reviewed, ONLY Venul ticks Applied (after mysqldump + manual apply + BE restart).
Reason: State was scattered across folder prefixes, a stale mega-closeout tracker, plan tables, and chat memory — every session re-derived it. Two migration-gate breaches (V59, V60) happened partly because "reviewed" and "applied" had no visible separate states.

---

## 2026-07-16 — no-concurrent-builds-on-target
Captured in: Coder session (Wave C — WAR-missing-resources incident, 15:37 build)
Rule: Never run `mvn clean package` while ANY other process can write to `target/` — close the IDE or disable its Java auto-build first (Antigravity/VS Code language server included). One build, one writer. After packaging, the R-BE-004 content check extends to PRESENCE: `jar tf target\valuation-erp-backend.war | findstr /i "application.yml openapi.yaml"` must list both under WEB-INF/classes/ before any `java -jar`.
Reason: On 2026-07-16 a WAR was packaged while a second builder was rewriting target/ — the war plugin zipped a half-populated classes dir: full `com/` class tree, ZERO resource files (no application.yml/openapi.yaml/db/seed). Result: "Failed to configure a DataSource: 'url' attribute is not specified" on five consecutive start attempts, with a source yml that was perfectly valid. mtime forensics: WAR 15:37:35, target/classes/application.yml 15:39:08 — resources restored AFTER packaging by the concurrent process. R-BE-002's `clean` rule doesn't cover this — the race re-corrupts even a clean build.

---

## 2026-07-15 — md-files-render-as-markdown
Captured in: Planner/war-room session (FILE-MAP rewrite)
Rule: `.md` files must use real markdown structure — headings, tables, fenced code blocks. ASCII box-drawing layouts (`╔═╗`/`┌─┐` panels) are FORBIDDEN in `.md` files: markdown preview collapses the whitespace and renders soup. Box-drawing style is reserved for plain-text paste artifacts (e.g. `session-starters.md` content that gets pasted into chats, where the fenced-paste context preserves it).
Reason: FILE-MAP v1 was written box-style in a `.md` and was unreadable in VS Code preview — rewritten same day. Navigation docs that can't be read in preview don't get read.

---

## 2026-07-17 — war-sanity-gate-before-handover
Captured in: Planner/war-room session (locked-WAR incident)
Rule: A green `mvn clean package` is NOT proof of a shippable artifact. Before any WAR is handed to the deploy route (or run), assert its resources are actually inside it:
```
Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force   # release any file lock FIRST
mvn clean package -DskipTests
jar tf target\valuation-erp-backend.war | Select-String "classes/application.yml"   # must hit
jar tf target\valuation-erp-backend.war | Select-String "classes/openapi.yaml"      # must hit
```
A `maven-clean` failure ("Failed to delete ...valuation-erp-backend.war") means a process holds the WAR — treat every artifact from that run as untrustworthy and rebuild, even if the build later reports BUILD SUCCESS.
Reason: 2026-07-17 — a WAR built while `java -jar` held the lock packaged ONLY .class files (no application.yml / openapi.yaml / db/seed), then failed at boot with the misleading "Failed to determine a suitable driver class" (the MySQL driver was present; the datasource URL was not, because the config file was missing). The 2026-07-08 shipped WAR contains all resources — the A/B comparison is what proved it. Had it reached the third-party deploy folder, production would have failed to start with an error pointing at the wrong cause entirely. Now run-book §6 (production cut).

---

## 2026-08-20 — tenant-isolation-data-scoping
Captured in: Coder session (chunk AC-085 document tenant guard)
Rule: All database queries and data fetch operations across repository, controller, and service layers MUST explicitly scope records by `clientId` (and `orgId` where applicable) derived from `UserContext` / security principal to enforce multi-tenant isolation and prevent cross-tenant data leaks. Single-record reads, deletes, updates, and bulk operations must fail closed (reject or skip) when `clientId` is null or does not match the caller's tenant.
Reason: Prevents cross-tenant access, data leaks, or unauthorized mutation where sequential ID guessing or unguarded fetch endpoints bypass tenant isolation.

---

## 2026-08-20 — searchable-select-portal-rendering
Captured in: Coder session (ReassignModal SearchableSelect dropdown fix)
Rule: `SearchableSelect` component must use React Portal (`createPortal` rendering to `document.body`) for its dropdown list container. All type-to-filter / searchable dropdown controls across the application MUST render their dropdown menus into `document.body` via React Portals rather than inside localized component DOM trees.
Reason: Dropdown menus rendered inside modal containers, form cards, or overflow-restricted wrappers (`overflow: hidden` / `overflow-y: auto`) get clipped or sliced at container borders or modal footers. Portal rendering mounts the dropdown directly to `document.body` at `z-index: 999999` with dynamic absolute positioning, guaranteeing that dropdown menus open downward and float cleanly over all modals, footers, overlays, and screen boundaries without cropping or clipping.
