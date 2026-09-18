# API Standards — Prathap Valuation ERP

> Every endpoint must conform to this. AI loads this before any BE work.
> Deviations flagged by Architect session as tech debt.

---

## 1. URL Structure

```
/api/{module}/{resource}
/api/{module}/{resource}/{id}
/api/{module}/{resource}/{id}/{sub-resource}
```

**Examples:**
```
GET  /api/master/companies
GET  /api/master/companies/{id}
POST /api/master/companies
PUT  /api/master/companies/{id}
DELETE /api/master/companies/{id}
GET  /api/master/companies/dropdown       ← special: plain list
GET  /api/master/companies/all            ← all records, no pagination
```

**Rules:**
- Lowercase kebab-case only: `/api/master/bank-officers`, not `/api/master/bankOfficers`
- Plural nouns for collections: `/companies`, not `/company`
- No verbs in URLs: not `/api/master/getCompanies`, not `/api/master/createCompany`
- Sub-resources via nesting: `/api/assignments/{id}/comments`, not `/api/comments?assignmentId={id}`

---

## 2. HTTP Verb Mapping

| Verb | Use | Idempotent |
|------|-----|------------|
| GET | Read only — never modifies state | Yes |
| POST | Create a new resource | No |
| PUT | Full update of existing resource | Yes |
| PATCH | Partial update — status transitions | Yes |
| DELETE | Soft delete (sets isActive=false) | Yes |

**Never use GET with a body.** Use query params or POST.

---

## 3. Response Envelope

### CRUD endpoints — always use `ApiResponse<T>`

```json
{
  "success": true,
  "message": "Company created successfully",
  "data": { ... }
}
```

```json
{
  "success": false,
  "message": "Company name already exists",
  "data": null
}
```

### Dropdown endpoints — plain array, no wrapper

```
GET /api/master/companies/dropdown
→ [{ "id": 1, "name": "ABC Valuers" }, ...]
```

**FE reads dropdowns as `res.data` — not `res.data.data`.**

### Paginated list endpoints

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "content": [...],
    "totalElements": 100,
    "totalPages": 10,
    "number": 0,
    "size": 10
  }
}
```

**FE reads paginated as `res.data?.data?.content`.**

---

## 4. HTTP Status Codes

| Code | When |
|------|------|
| 200 | Successful GET, PUT, PATCH, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation failure, business rule violation, bad request |
| 401 | Missing or invalid auth token |
| 403 | Authenticated but not authorised for this action |
| 404 | Resource not found (non-existent ID) |
| 409 | Conflict — duplicate record attempt |
| 500 | Unhandled server error (should be rare) |

**Never return 200 with `success: false`.** Use the correct status code.

---

## 5. Error Response Format

All errors follow the same envelope:

```json
{
  "success": false,
  "message": "Company name 'ABC Valuers' already exists",
  "data": null
}
```

- Message must be human-readable — not a stack trace, not a Java exception class name
- Specific enough to act on: "Company name already exists" not "Validation failed"
- For field-level errors (validation), message lists which field: "Phone number must be 7–15 digits"

**Exception mapping (enforced by `@ControllerAdvice`):**

| Exception | HTTP Code |
|-----------|-----------|
| `ValidationException` | 400 |
| `ResourceNotFoundException` | 404 |
| `DuplicateResourceException` | 409 |
| `AccessDeniedException` | 403 |
| `AuthenticationException` | 401 |
| Uncaught `RuntimeException` | 500 |

---

## 6. Pagination

Default page size: **10** records.
Maximum page size: **100** (enforce in service layer — reject requests for > 100).

Query params:
```
GET /api/master/companies?page=0&size=10&sort=name,asc
```

- `page` is zero-indexed
- `sort` format: `{field},{direction}` — `name,asc` or `createdAt,desc`
- Always paginate list endpoints — never return unbounded lists
- Exception: `/all` and `/dropdown` endpoints are allowed to return full lists (still sorted)

---

## 7. Filtering & Search

Pass filters as query params on GET:

```
GET /api/assignments?statusCode=NEW&valuerId=5&page=0&size=10
```

- Boolean filters: `?isActive=true`
- Date range: `?fromDate=2026-01-01&toDate=2026-12-31`
- Free-text search: `?search=ABC` (searches across searchKey + name)

Never put filter params in the request body of a GET.

---

## 8. Endpoint Naming Conventions

| Pattern | URL | Notes |
|---------|-----|-------|
| List paginated | `GET /api/{module}/{resource}` | Default with pagination |
| Get by ID | `GET /api/{module}/{resource}/{id}` | Returns single object |
| Get all (no page) | `GET /api/{module}/{resource}/all` | For large select needs |
| Dropdown list | `GET /api/{module}/{resource}/dropdown` | `[{id, name}]` only |
| Create | `POST /api/{module}/{resource}` | |
| Update | `PUT /api/{module}/{resource}/{id}` | |
| Soft delete | `DELETE /api/{module}/{resource}/{id}` | Sets isActive=false |
| Status transition | `PATCH /api/{module}/{resource}/{id}/transition` | |
| Geography reverse fill | `GET /api/master/cities/{id}/geography` | Returns `{cityId, districtId, regionId, countryId}` |

---

## 9. Versioning

Current API has no version prefix — do not add one retroactively.
If breaking changes are needed in future: `/api/v2/{module}/{resource}`.
Old version must remain functional until all FE consumers are migrated.

---

## 10. Auth

All endpoints require `Authorization: Bearer {JWT}` header except:
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- Health check endpoints

Missing token → 401. Valid token, insufficient role → 403.

---

## 11. OpenAPI / Swagger

All controllers must have `@Operation` and `@ApiResponse` annotations for Swagger doc generation.
Swagger UI available at `/swagger-ui.html` in dev/staging — **disabled in production**.
