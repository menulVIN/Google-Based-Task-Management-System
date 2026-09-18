# Git Standards — Prathap Valuation ERP

> Every commit, branch, and PR follows this. No exceptions.

---

## 1. Branch Naming

```
{type}/{short-description}
```

| Type | When |
|------|------|
| `feature/` | New functionality |
| `fix/` | Bug fix |
| `hotfix/` | Critical production fix (applied directly off main) |
| `refactor/` | Code restructure — no behaviour change |
| `chore/` | Tooling, deps, config — no app logic |
| `td/` | Tech debt item from registry (use TD-XXX number) |

**Examples:**
```
feature/valuer-availability-grid
fix/assignment-duplicate-on-complete
td/TD-012-n-plus-one-assignments
hotfix/fee-calc-wrong-rate
```

**Rules:**
- All lowercase, kebab-case only — no spaces, no underscores, no camelCase
- Short and descriptive — max 50 characters
- Never commit directly to `main` or `develop`
- Branch from `develop` for features/fixes; branch from `main` for hotfixes

---

## 2. Commit Messages

```
{type}: {short summary in imperative mood}

{optional body — what changed and why, if not obvious}
```

**Subject line rules:**
- Imperative mood: "Add fee validation" not "Added fee validation" or "Adds fee validation"
- No period at the end
- Max 72 characters
- Type prefix required (same list as branch types)

**Examples:**
```
feat: add valuer availability grid with date filter
fix: prevent duplicate assignment on Complete button click
refactor: extract assignment state into useAssignmentForm hook
td: resolve N+1 query on assignments list endpoint
chore: upgrade Spring Boot to 2.7.18
```

**Body (optional but encouraged for non-obvious changes):**
```
fix: prevent duplicate assignment on Complete button click

handleSubmit was calling createAssignment() regardless of whether
the assignment already existed. Added ID check to branch into
update/navigate for existing records.

Closes TD-008.
```

---

## 3. Commit Hygiene

- One logical change per commit — do not batch unrelated fixes into one commit
- Do not commit commented-out code
- Do not commit `console.log` or `log.debug()` statements
- Do not commit `.env` files, IDE config files (`.idea/`, `.vscode/`)
- Build must pass before committing — never commit broken code
- Run `npx vite build` (FE) or `mvn clean package -DskipTests` (BE) before committing

---

## 4. Pull Request Format

**Title:** `{type}: {summary}` — same format as commit subject line
**Max title length:** 70 characters

**Body template:**
```
## What changed
- [bullet list of changes]

## Why
[business or technical reason — one sentence]

## Tests
- [ ] BUILD SUCCESS / clean Vite build
- [ ] Postman suite passed (BE) / browser checklist passed (FE)
- [ ] Edge cases documented

## Tech debt
- Closes TD-XXX (if applicable)
- Opens TD-XXX (if this introduces known debt)

## Screenshots (FE changes only)
[paste before/after screenshots for any UI change]
```

---

## 5. PR Rules

- Every PR requires at least one review before merge (even if solo — use a self-review checklist)
- No force-push to `main` or `develop` — ever
- Squash-merge for feature branches into `develop` to keep history clean
- Merge commit for hotfixes into `main` so the fix is traceable
- Delete the branch after merge — no stale branches

---

## 6. gitignore Minimums

Always include in `.gitignore`:
```
.env
.env.*
target/
node_modules/
dist/
*.class
*.log
.idea/
.vscode/
*.iml
```

---

## 7. Tagging

Releases tagged as `v{major}.{minor}.{patch}` on `main`:
- Patch: bug fixes, no new features
- Minor: new features, backwards compatible
- Major: breaking changes, major redesigns

Tag message must include what changed at a high level.
