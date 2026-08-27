# AI Session History — Stage 2: Authentication & Multi-Tenant Organization Setup

**Project:** Inter-Office Memo Management System (CSE226)
**Tool:** Claude Code
**Scope of this session:** Login, JWT auth, organization+admin creation, tenant isolation, role authorization, and the frontend auth foundation only. No memo/workflow/notification/reporting work.

This document is a chronological record of the session: what was asked, what was built, what failed or was corrected along the way, and what was verified before each step was called done.

---

## 1. Starting point

Stage 1 (monorepo foundation, Mongoose models, app skeletons) was already committed to git in three commits (`Initial commit`, the foundation commit, and the Stage 1 `ai-history` export). `git status` confirmed a clean working tree before starting.

The phase 2 request was large and explicit: implement login, JWT auth, bcrypt hashing, auth middleware, an organization-creation endpoint that also creates the initial admin user, a server-derived (never client-trusted) multi-tenant identity context, reusable tenant-isolation and role-authorization middleware, a protected `/api/auth/me` endpoint, and a frontend auth foundation (login page, auth context, protected routes, Axios token attachment, logout) — explicitly stopping short of memo/workflow/notification/reporting/admin-CRUD work, and requiring Route → Controller → Service → Model layering rather than logic in route files.

Before writing anything, the existing files this phase would build on were read in full: `models/User.js`, `middleware/errorHandler.js`, `routes/index.js`, `routes/organization.routes.js`, `app.js`, `backend/package.json`, `backend/.env.example`, and the frontend's `AppRoutes.jsx`, `services/api.js`, `main.jsx` — so the new code would match Stage 1's conventions rather than reinvent them.

---

## 2. Design decisions made before writing code

A few architectural calls were made explicitly, since the spec left room for judgment:

- **Login looks up by email only**, not email *and* organization. The existing `User` schema (from Stage 1) had a compound unique index on `(organizationId, email)`, which technically permits the same email to exist in two different organizations — making an email-only login theoretically ambiguous. This was flagged as a known simplification in the closing report rather than silently resolved, since the spec's suggested endpoint (`POST /api/auth/login`) didn't ask for an organization selector. (This tradeoff was revisited and fixed later — see §9.)
- **`protect` middleware trusts the JWT payload directly** (`req.user` built from the decoded token: `id`, `organizationId`, `role`, `departmentId`) rather than re-querying the database on every request. This matches the spec's explicit shape for `req.user` and keeps the middleware fast; `/api/auth/me` is the one endpoint that does hit the database, since it needs to return current profile fields the JWT doesn't carry.
- **Tenant isolation was built as two reusable primitives**, not a single one-size-fits-all middleware, since different future resources will relate to `organizationId` differently:
  - `middleware/tenantIsolation.js` → `requireSameOrganization(param)`, for routes where the resource id is directly in the URL (used immediately by `GET /api/organizations/:id`).
  - `utils/tenantScope.js` → `withOrgScope(req, filter)`, a query-filter helper for future services (memos, departments, etc.) to merge `organizationId` from `req.user`, never from client input.
- **`GET /api/organizations/:id` was made admin-only** (`authorize('admin')` + `requireSameOrganization('id')`), specifically so there would be a genuine, justified role-gated route to prove the role middleware — rather than inventing a synthetic test-only endpoint.
- **No database transaction around organization+admin creation.** If `Organization.create` succeeds but the subsequent `User.create` fails (e.g. a validation error), the organization is left without an admin. This was accepted as a known limitation for a later hardening pass rather than adding multi-document transaction handling (which also assumes a replica-set MongoDB) at this stage — mitigated partially by validating `adminEmail`'s format *before* creating the organization, to fail fast in the common case.
- **A real test suite was added** (Jest + Supertest + `mongodb-memory-server`, backend `devDependencies` only) rather than only ad hoc manual verification, since the spec's "Testing" section asked for a fairly detailed, repeatable checklist (login success/failure, JWT accept/reject/expired, two-org tenant isolation, role rejection).

---

## 3. Version check, and a repeat of the Stage 1 mistake

Before adding test tooling, `npm view <package> version` was run for `jest`, `supertest`, and `mongodb-memory-server` to get real current versions rather than relying on memory (`30.4.2`, `7.2.2`, `11.2.0`).

**Mistake caught immediately:** the first draft of `backend/package.json`'s `devDependencies` was written from memory anyway — `jest@^29.7.0`, `supertest@^7.0.0`, `mongodb-memory-server@^10.1.2` — which didn't match what had just been queried seconds earlier. This is the same category of slip as the Vite version mismatch in Stage 1. It was noticed on review of the diff and corrected to `^30.4.2` / `^7.2.2` / `^11.2.0` before any install was run.

---

## 4. Backend implementation

Built in dependency order:

- **`utils/`**: `ApiError.js` (a small `Error` subclass carrying `statusCode`), `asyncHandler.js` (wraps async route handlers so they forward rejections to `next`), `jwt.js` (`generateToken`/`verifyToken`, reading `JWT_SECRET`/`JWT_EXPIRES_IN` from `process.env` at call time), `validators.js` (`isValidEmail`), `tenantScope.js` (`withOrgScope`).
- **`middleware/`**: `auth.js` (`protect` — verifies the `Bearer` token, distinguishes missing/invalid/expired with clear 401s), `role.js` (`authorize(...roles)` — 403 if `req.user.role` isn't in the allowed list), `tenantIsolation.js` (`requireSameOrganization(param)` — 403 if a URL param doesn't match the JWT's `organizationId`).
- **`services/`**: `auth.service.js` (`login`, `getCurrentUser`), `organization.service.js` (`createOrganizationWithAdmin`, `getOrganizationById`) — all business logic and Mongoose access lives here, not in controllers or routes.
- **`controllers/`**: `auth.controller.js`, `organization.controller.js` — thin, just translate `req`/`res` to service calls.
- **`routes/`**: new `auth.routes.js` (`POST /login`, `GET /me`); `organization.routes.js` rewritten from its Stage 1 placeholder into `POST /` (public, provisioning) and `GET /:id` (`protect` → `authorize('admin')` → `requireSameOrganization('id')`); both mounted in `routes/index.js`.
- **`models/User.js` modified**: added a schema-level `toJSON` transform that deletes `password` from every serialized output, as defense-in-depth on top of the existing `select: false` — so a controller that forgets to exclude the field still can't leak it.
- **`middleware/errorHandler.js` modified**: now distinguishes Mongoose `ValidationError` (→ 400, combined field messages), duplicate-key errors (`code === 11000` → 409, naming the field), and `CastError` (→ 400), and hides the raw message behind a generic "Internal Server Error" for uncategorized 500s when `NODE_ENV=production`.
- **`backend/.env.example`**: the `JWT_SECRET`/`JWT_EXPIRES_IN` lines already existed from Stage 1 (anticipating this phase); only the stale "not used yet" comment was updated.

---

## 5. Tests written

- `tests/setup.js` — starts a `mongodb-memory-server` instance and connects Mongoose in `beforeAll`, clears all collections in `afterEach`, disconnects and stops the server in `afterAll`.
- `tests/helpers.js` — `createOrganizationWithAdmin(app, overrides)`, generating a random org identifier/admin email per call so tests don't collide.
- `tests/auth.test.js` — organization+admin creation (success, duplicate identifier, missing fields), login (success with no password leak, wrong password, non-existent email, missing credentials), `/api/auth/me` (valid token, no token, invalid token, expired token minted directly with `jsonwebtoken` and a negative `expiresIn`).
- `tests/tenantIsolation.test.js` — two organizations/two admins; asserts each one's `/api/auth/me` context shows their *own* organization; asserts cross-organization `GET /api/organizations/:id` is denied (403) and same-organization access succeeds (200).
- `tests/role.test.js` — an admin can read their org via the admin-gated route; a second, non-admin user created directly through the `User` model (no invite endpoint exists yet, so this was seeded directly rather than built just for the test) is rejected (403) from the same route.

First run: **3 suites, 16 tests, all passing.**

---

## 6. Installing dependencies — a long background wait

`npm install` in `backend/` (to pull in `jest`, `supertest`, `mongodb-memory-server`) ran long enough to be moved to a background task automatically. While it ran, the frontend was rebuilt independently as a sanity check (86 modules transformed, Tailwind CSS present in the output, build succeeded) and its `dist/` artifact was removed afterward.

When the background install finished, its log contained a line worth double-checking:
```
bcrypt@5.1.1 (install: node-gyp rebuild)
```
This differed from Stage 1, where bcrypt's install log showed a prebuilt-binary path (`node-pre-gyp install --fallback-to-build`) instead — `node-gyp rebuild` implies a from-source compile, which needs real build tools and can fail silently or produce a broken binding. Rather than trust it, bcrypt was exercised directly:
```js
const bcrypt = require('bcrypt');
bcrypt.hash('test123', 10).then(h => bcrypt.compare('test123', h)).then(console.log);
```
This returned a real hash and `true` on compare, confirming the native binding was actually functional despite the different install path.

---

## 7. Live, real-HTTP verification (beyond the automated suite)

The phase's own checklist asked for manual verification (start MongoDB, start backend, create an org, log in, check `/me`, check protected routes, check cross-org denial) in addition to automated tests — so this was done for real, against a running server, not only via in-process Supertest calls.

**First attempt failed:** a script to start `mongodb-memory-server` was written into the OS scratch/temp directory and run with `node <path-in-scratch>/start-test-mongo.js`. It immediately failed with:
```
Error: Cannot find module 'mongodb-memory-server'
```
Node resolves `require()` relative to the *script's own location*, not the current working directory — so a script sitting outside `backend/` can't see `backend/node_modules`. Fixed by writing the same script as a temporary file directly inside `backend/` (deleted afterward) so it could resolve the package from the project's own install.

With that fixed, the real verification proceeded:
1. Started the temporary in-memory MongoDB, capturing its connection URI.
2. Wrote a temporary `backend/.env` pointing at it, with a throwaway `JWT_SECRET` (deleted afterward — never a real secret).
3. Ran the actual `node src/server.js` (not a test harness) and confirmed `MongoDB connected` + `Server running on port 5000` in its log, and `{"status":"ok"}` from `/api/health`.
4. Created **Organization A** (admin Alice) and **Organization B** (admin Bob) via real `curl` calls to `POST /api/organizations`; confirmed no password field in either response; confirmed a duplicate identifier returned `409`.
5. Logged in both Alice and Bob; confirmed tokens issued, no password in the response, wrong password → `401`, missing credentials → `400`.
6. Called `GET /api/auth/me` as each user; confirmed Alice's context showed Organization A and Bob's showed Organization B; confirmed no token → `401` and a garbage token → `401`.
7. The core tenant-isolation check: Alice's token against Organization B's id, and Bob's token against Organization A's id, **both returned 403** ("You do not have access to this organization's resources"); each admin reading their *own* organization returned `200`.
8. Separately started the Vite dev server with the new auth pages wired in and confirmed `curl` got `200` from both `/` and `/login`.

Everything from this manual pass — the temporary `.env`, the temporary Mongo-starter script, log files, saved tokens — was deleted afterward; none of it is part of the delivered repo.

---

## 8. Closing report for the phase

The full report to the user covered files created/modified, the four new endpoints (`POST /api/organizations`, `GET /api/organizations/:id`, `POST /api/auth/login`, `GET /api/auth/me`), the authentication flow, the tenant-isolation and role-authorization approach, and the tests/verification performed. It also proactively surfaced the login-by-email-only tradeoff from §2 as a known limitation rather than leaving it undocumented.

---

## 9. Follow-up: making email globally unique

The user asked to resolve the exact tradeoff flagged in §8: make `email` globally unique (not just per-organization), so login-by-email is unambiguous by construction, while preserving the `organizationId` relationship and tenant isolation, adding a test proving cross-organization duplicate emails are rejected, and keeping all existing tests green.

Changes made:
- `models/User.js`: added `unique: true` directly to the `email` schema path; removed the old compound `{ organizationId: 1, email: 1 }` unique index; added back a plain **non-unique** `{ organizationId: 1 }` index so organization-scoped user queries (needed in later phases) don't lose the lookup performance the old compound index incidentally provided. This was called out explicitly as a small, justified side effect rather than done silently.
- Grepped the whole backend for any other code that assumed the old per-organization uniqueness — found none; the login lookup was already email-only and needed no change.
- Added a test to `auth.test.js`: create Organization A's admin with email E, then attempt to create a *different* Organization B whose admin also uses E — asserts the second creation returns `409`, and that exactly one `User` document with email E exists afterward, still owned by Organization A. This exercises the actual MongoDB unique index (the service layer only pre-checks the org identifier, not email), not just application-level logic.

Result: **3 suites, 17 tests, all passing** (16 previous + 1 new). Frontend rebuilt as an unaffected sanity check — unchanged, succeeded, artifact removed.

---

## 10. Follow-up: two diagnostic questions, no speculative fixes

The user asked two direct questions and was explicit that no code should change unless something was actually wrong:
1. Is `JWT_EXPIRES_IN` read from `.env`, or hardcoded?
2. Do "invalid email" and "invalid password" return the exact same status/message in the login endpoint, or does one leak which was wrong?

Both were answered by reading the current source directly (`jwt.js`, `.env.example`, `auth.service.js`) rather than recalling from earlier in the session:
- `JWT_EXPIRES_IN` **is** read from `.env` — `process.env.JWT_EXPIRES_IN || '7d'` — the literal `'7d'` is only a fallback if the variable is absent, not an override. No fix needed.
- Invalid email and invalid password **already** throw the identical `ApiError(401, 'Invalid email or password')`. No fix needed.

While checking, an **unprompted, adjacent finding** was surfaced rather than silently fixed: the `user.status !== 'active'` check ran *before* the password check, so an inactive/suspended account returned a distinguishing `403` regardless of whether the submitted password was right or wrong — a smaller version of the same enumeration concern, via status code instead of message text. Since this wasn't one of the two things asked, it was reported and the user was asked whether they wanted it fixed too, rather than changed unilaterally.

---

## 11. Follow-up: fixing the status-check ordering

The user confirmed the fix: verify the password *before* checking `user.status`, so a wrong password always yields the generic 401 regardless of account status, and the account-inactive 403 only fires once the password is confirmed correct.

- `auth.service.js`: swapped the order of the two checks after the user lookup — `bcrypt.compare` now runs first; the `status !== 'active'` check now runs only after a successful password match.
- Added two tests to `auth.test.js`: an inactive account with the *correct* password now returns `403` / `"This account is not active"`; an inactive account with the *wrong* password returns the same generic `401` / `"Invalid email or password"` used everywhere else.

Result: **3 suites, 19 tests, all passing** (17 previous + 2 new). No other files touched.

---

## 12. This export, and an unresolved request

The user asked for two things in one message: export this stage's transcript to `ai-history/stage-2-auth.md`, and add "those two Section 26.9 notes while they're fresh (global email uniqueness; the sequential-but-extendable workflow model)."

The whole project directory was searched for `26.9` / `Section 26` and nothing matched — that section does not exist anywhere in this repository, so it must refer to a document outside it (a proposal, design doc, or personal notes file not available here). A clarifying question about where that section lives was raised via the question tool; the user interrupted/declined it and asked only for this transcript export instead.

**The "Section 26.9" notes have not been added anywhere.** That part of the request is still open — resolving it needs to know where "Section 26.9" actually is (a separate document to point at or paste from, or a new running notes file to start in this repo) before anything can be written into it.
