# AI Session History — Password Security Hardening

**Project:** Inter-Office Memo Management System (CSE226)
**Tool:** Claude Code
**Scope of this session:** A focused security-hardening task, explicitly scoped to not touch authentication architecture — no JWT, session, role, organization-scoping, or authorization changes, no new dependency, no change to the existing bcrypt hashing mechanism unless a real problem was found (none was). Introduce a stronger password policy, enforce it server-side at every point a password is created, add matching frontend validation to the existing forms, and add tests — without redesigning anything.

---

## 1. Inspection before modifying

Read every relevant file before writing anything. Findings:

- **Password validation** existed in exactly two places, both a bare `password.length < 8` check with no complexity rules: `organization.service.js`'s `createOrganizationWithAdmin` (self-service registration) and `user.service.js`'s `createUser` (admin creates a user).
- **Password hashing** happens in one shared place: `auth.service.js` exports `hashPassword = (password) => bcrypt.hash(password, 10)`, called from both locations above, right before `User.create`. Login compares via `bcrypt.compare`. The `User` schema already marks `password` as `select: false` and strips it in `toJSON` as defense-in-depth.
- **No password-change or password-reset endpoint exists anywhere** (confirmed via grep across the whole backend) — so the policy only needed wiring into the two creation points.
- **Frontend**: `Register.jsx` and `UsersSection.jsx`'s "New User" form both used a plain `minLength={8}` HTML attribute on a password input — no complexity check, no requirements shown, no confirmation field on either form.
- **A load-bearing discovery**: the shared test helper `tests/helpers.js` (`createOrganizationWithAdmin`, used by nearly every test file in the suite) defaulted `adminPassword` to `'SuperSecret123'` — no special character. Enforcing the new policy server-side would fail this default and cascade-break most of the suite unless updated. Traced every test file sending a password through the *real* validated endpoints (as opposed to several helpers that bypass the service layer entirely via direct `bcrypt.hash` + `User.create`, which don't need touching) and found exactly 9 string literals across 5 files needing an update.

---

## 2. Policy and server-side enforcement

Policy: ≥8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character (`[^A-Za-z0-9]`, no restricted set) — matches every example given, both valid and invalid.

New `backend/src/utils/passwordPolicy.js` exports `isValidPassword` and `assertPasswordPolicy` (throws the existing `ApiError(400, ...)` pattern with a static, generic message — never echoes the submitted password, never reveals which specific rule failed). Wired into both `organization.service.js` and `user.service.js` in the exact position the old length check occupied — before hashing, before persistence — via one shared function call, so the two flows are structurally guaranteed identical rather than kept in sync by hand (directly addresses the review requirement to check for inconsistent validation between registration and user-creation).

---

## 3. Test fixture updates

9 hardcoded passwords updated across `tests/helpers.js` (the shared default, affecting nearly the whole suite), `tests/department.test.js`, `tests/auditLog.test.js`, `tests/adminOnlyRoutes.test.js`, and 5 in `tests/user.test.js` — same assertions, same test intent, just a password string that now satisfies the new policy. Two deliberately left alone: `XPassword123` and `BlockedPass123`, both used in tests asserting a **403** for a non-admin — confirmed via `user.routes.js`'s `router.use(protect, authorize('admin'))` that the role-check middleware runs before the controller ever reaches password validation, so these never needed to comply. Also confirmed a subtler case: `user.test.js`'s duplicate-email test (`DuplicatePass123`) needed fixing too, since password validation runs *before* the duplicate-email check in `createUser` — an unfixed, non-compliant password there would have returned `400` instead of the test's expected `409`, breaking it for the wrong reason.

---

## 4. Frontend validation

New `frontend/src/utils/passwordPolicy.js` mirrors the backend rules exactly (kept as two files, not shared code, since frontend/backend don't currently share a module boundary — documented as a deliberate sync point via a comment in both files). New `ui/PasswordRequirements.jsx` renders a live checklist (gray → blue with a checkmark, per-requirement, as the user types), reusing the existing `Field`-adjacent visual language rather than inventing new UI. Wired into `Register.jsx` and `UsersSection.jsx`'s create-user form: both now block submission entirely (verified live: zero network request fires) on either a policy violation or a mismatched confirm-password field, showing a clear inline error in the existing red-banner style already used for API errors elsewhere in the app.

---

## 5. Verification

- **22 new tests** in `passwordPolicy.test.js`: unit-level policy checks; registration-endpoint accept/reject for every category (too short, no upper, no lower, no number, no special, empty, whitespace-only); the identical set again against the user-creation endpoint to prove enforcement is structurally the same; a check that a rejected password is never echoed back in the error response; a check that nothing is persisted on a rejected attempt; a check that the stored value is a genuine bcrypt hash (`$2...` prefix), never plaintext.
- **Full backend suite**: 225/225 passing, 30/30 suites (203 pre-existing + 22 new) — the 203 figure already includes a Workflow Templates feature added separately outside this session, left untouched throughout.
- **Frontend production build**: clean, 142 modules.
- **Live browser verification, both forms** (not just code review): `Register.jsx`'s mismatch case — "Passwords do not match.", zero `POST /api/organizations` calls. `UsersSection.jsx`'s mismatch case — same error, zero `POST /api/users` calls. `UsersSection.jsx`'s weak-password case — requirements message shown, zero API calls. Screenshot-confirmed the requirements checklist renders correctly inside the "New User" form on the Administration page, matching the existing visual design.
- **Direct API bypass**: a request sent straight to `POST /api/organizations`, no frontend involved, with a non-compliant password, got `400` and the exact static requirements message — confirming the backend is genuinely the authoritative enforcement point, not just a redundant mirror of the frontend.

---

## 6. Deliberate scope decisions

- **No `confirmPassword` field was added to the backend API contract.** Confirmation is enforced entirely client-side before the request is even sent; the backend only ever receives one final password value, matching its pre-existing contract exactly. This was a considered choice, not an oversight — adding a field the API never had would have been an unnecessary contract change for something the frontend can fully own.
- **bcrypt/10 rounds left unchanged** — no security problem was found with the existing hashing during inspection, so per the task's own instruction nothing there was touched.
- **The two 403-blocked test passwords were left non-compliant on purpose**, not missed — verified precisely why they don't need to comply (middleware order) rather than changing them defensively.

Committed as `c607bf5`, pushed to `origin/main`.
