# Security Standards — Prathap Valuation ERP

> Non-negotiable. Any deviation is 🔴 Critical tech debt.

---

## 1. Authentication

- All API endpoints require a valid JWT in the `Authorization: Bearer {token}` header
- Exceptions (no auth required): `POST /api/auth/login`, `POST /api/auth/refresh`, health check
- JWT expiry: access token 15–60 minutes, refresh token 7 days (do not lengthen without review)
- Expired token → 401 Unauthorized — FE redirects to login, clears stored token
- Invalid token → 401 Unauthorized
- Token refresh happens automatically on the FE before the request is retried — users must not see a login redirect mid-session if the refresh succeeds

---

## 2. Authorisation

- Role-based access control — every endpoint annotated with `@PreAuthorize` or equivalent
- Roles checked at the service layer, not just the controller
- Missing role → 403 Forbidden (not 404 — do not hide the existence of the resource)
- Admin endpoints (`/api/admin/...`) blocked for non-admin roles at the gateway/filter level

---

## 3. Input Validation & Sanitisation

- Validate all input at the controller layer using `@Valid` and Bean Validation annotations
- Do not trust client-supplied IDs for ownership checks — always verify the record belongs to the authenticated user's company
- Never build SQL strings by concatenating user input — use JPQL with named parameters or Spring Data methods
- Never pass user input directly to a shell command or file path
- File uploads (if any): validate MIME type server-side, not just by file extension — store outside the web root

---

## 4. Data Exposure

- Never return password hashes, raw tokens, or secret keys in any API response — not even in admin endpoints
- Never log passwords, tokens, PII (names, NIC, phone numbers, emails) at DEBUG or INFO level
- `SELECT *` is banned — always project only the columns needed
- Paginate all list endpoints — never return unbounded result sets that could expose bulk data

---

## 5. CORS

- CORS origins whitelist configured in Spring Security — do not use wildcard `*` in production
- Allowed origins: the specific FE domain(s) only
- Dev/local: `http://localhost:5173` (Vite default) allowed
- Staging/prod: domain locked to the deployed FE host
- CORS misconfiguration → 🔴 Critical tech debt

---

## 6. Error Responses

- Never expose stack traces in API responses — production error responses must not include exception class names, line numbers, or internal paths
- Use the standard `ApiResponse` envelope with a human-readable message only
- Log the full stack trace server-side at `log.error()` level — never swallow exceptions

---

## 7. Sensitive Data in Logs

| Forbidden in logs | Why |
|-------------------|-----|
| Passwords (any form) | Obvious |
| JWT tokens | Replayable |
| NIC / passport numbers | PII |
| Phone numbers | PII |
| Email addresses | PII |
| Bank account numbers | Financial PII |
| Full property addresses | PII |

Use masked versions for debugging if needed: `NIC: ****5678`

---

## 8. Transport

- All production traffic over HTTPS — HTTP redirected to HTTPS
- Staging also HTTPS — do not use plain HTTP for staging if it contains real data
- `Strict-Transport-Security` header enabled in production

---

## 9. Dependency Security

- No unpatched Spring Boot versions with known CVEs — check quarterly
- `mvn dependency:check` (OWASP plugin) run before any release
- Do not include test dependencies (`scope=test`) in the production artifact

---

## 10. Secrets Management

- No secrets (DB password, JWT secret, API keys) in source code or committed config files
- Use environment variables or an external secrets manager
- `.env` files: never committed — always in `.gitignore`
- If a secret is accidentally committed: rotate it immediately, then remove from history

---

## 11. Quick Checklist Before Shipping

- [ ] No hardcoded secrets in code
- [ ] No `SELECT *` queries
- [ ] All endpoints authenticated (unless explicitly public)
- [ ] All endpoints authorised by role
- [ ] No PII in logs
- [ ] Input validated at controller layer
- [ ] Error responses contain no stack traces
- [ ] CORS origin list locked to known domains
