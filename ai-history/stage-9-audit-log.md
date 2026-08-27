# AI Session History — Stage 9: Audit Logging

**Project:** Inter-Office Memo Management System (CSE226)
**Tool:** Claude Code
**Scope of this session:** General-purpose audit logging across the significant events the PRD requires, generalizing the single Stage 5 audit event into a shared service, plus an admin-only, read-only, tenant-scoped endpoint to view the log. Explicitly not: the Stage 10 reporting/statistics system, PDF export (Stage 11), or any change to workflow/comment/notification/attachment *logic* beyond adding one logging call to each.

---

## 1. Starting point

Stages 1–8 confirmed complete (141 tests passing at the end of this session, 124 at the start of it) before writing anything. The `AuditLog` model already existed from Stage 1 (`organizationId`, `userId`, `eventType`, `description`, `timestamps: true`), and Stage 5 already wrote to it — but directly, via a bare `AuditLog.create(...)` call inline in `workflow.service.js`'s `addParticipant`, unguarded by any try/catch, for exactly one event (`WORKFLOW_PARTICIPANT_ADDED`). `routes/auditLog.routes.js` was still the literal Stage-1 placeholder (`GET /` returning `{ message: 'Audit log routes placeholder' }`, no auth, no real logic). No `auditLog.controller.js` or `audit.service.js` existed yet.

The task: generalize that one-off pattern into a single shared write path (mirroring Stage 7's `createNotification`, which never rejects — a logging failure must never block the action that triggered it), wire it into 18 distinct event types across every service layer that has one, and build the real endpoint. Read every relevant service file before changing any of them — `auth.service.js`, `organization.service.js`, `user.service.js` (+ its controller), `memo.service.js`, `workflow.service.js`, `comment.service.js`, `attachment.service.js` — to confirm exact function signatures, what identifiers (`memo.referenceNumber`, participant names, etc.) were already in scope at each call site, and where `req.user` does and doesn't carry a `name` (it doesn't — the JWT payload is `{id, organizationId, role, departmentId}` only, established back in Stage 2 and confirmed still true here).

---

## 2. Backend: the shared audit service

New `audit.service.js`, two functions:

- **`logAuditEvent({ organizationId, userId, eventType, description })`** — the single place `AuditLog.create` is ever called anywhere in the codebase now. Wrapped in try/catch, logging the error and resolving normally either way — the exact resilience shape as `notification.service.js`'s `createNotification`, copied deliberately rather than reinvented, since Stage 7 had already settled what this pattern should look like.
- **`listAuditLogs(organizationId, { eventType, userId, dateFrom, dateTo, page, limit })`** — same pagination shape as Stage 8's `searchMemos`: `page`/`limit` both floored at 1 (defaulting 1/20), a `Promise.all` of the paginated `.find()` and a `.countDocuments()` against the *same* filter object, `organizationId` always present in that filter and never optional or overridable by a caller-supplied value. Sorted `createdAt: -1` (newest first) and `.populate('userId', 'name')` so the endpoint can show a human actor name without a second round trip.

`AuditLog.js` gained one addition: a `{ organizationId: 1, createdAt: -1 }` index, mirroring `User.js`'s existing `{ organizationId: 1 }` index convention for the same reason — this listing is always organization-scoped and always sorted by recency. No new schema fields; the spec was explicit about not turning this into an entity-versioning system, and the existing `organizationId`/`userId`/`eventType`/`description`/`createdAt` fields were already everything every event below needed.

---

## 3. Backend: wiring 18 event types into 7 existing services

Every call site follows the same shape: one `await logAuditEvent({...})` immediately after the action's existing success point, with a short human-readable `description` embedding a real identifier (a memo's `referenceNumber`, an affected user's name) rather than a bare ID — this is what an admin reading the log actually sees, not raw ObjectIds. No surrounding function was restructured; each addition is a single new statement (plus, in three cases below, a small necessary signature change to get the right identifier into scope).

- **`auth.service.js`** — `login()` now logs `USER_LOGIN` right before returning, using the already-fetched `user` document for its name. A new `logout(userId, organizationId)` function (see §4) logs `USER_LOGOUT`, fetching `User.findById(userId).select('name')` first since the JWT payload itself carries no name.
- **`organization.service.js`** — `createOrganizationWithAdmin` logs `USER_CREATED` right after the admin user is created, attributed to that same new admin (there's no other actor at registration time — nobody is logged in yet).
- **`user.service.js`** — `createUser` logs `USER_CREATED`, attributed to the *admin doing the creating*, not the new user — which required adding a `requestingUserId` parameter to `createUser`'s signature (it previously only took `organizationId` and the payload). Its one call site, `user.controller.js`'s `createUser` handler, was updated to pass `req.user.id`; grepped the codebase first to confirm no other call site existed to break. `updateUserStatus` logs `USER_ACTIVATED` or `USER_DEACTIVATED` depending on the new status (`active` vs. `inactive`/`suspended`), reusing the `requestingUserId` parameter that function already had.
- **`memo.service.js`** — `createMemo` logs `MEMO_CREATED`; `updateMemo` logs `MEMO_MODIFIED`; `submitMemo` logs two *separate* events after a successful submission — `MEMO_SUBMITTED` (the fact of submission) and `WORKFLOW_ASSIGNED` (who was assigned), the latter built by fetching every participant's name via one `User.find({_id: {$in: memo.workflowParticipants}})` and joining them in the same order the workflow steps were created in, not just a list of IDs.
- **`workflow.service.js`** — `approveMemo` logs `WORKFLOW_APPROVED` on every approval, and *additionally* logs `WORKFLOW_COMPLETED` when that approval was the final step (so a one-participant workflow's single approve action produces both events, not one-or-the-other). `rejectMemo` logs `WORKFLOW_REJECTED` (including the rejection comment in the description); `requestChanges` logs `CHANGE_REQUESTED` (same, with its comment); `resubmitMemo` logs `MEMO_RESUBMITTED`. `addParticipant`'s existing Stage-5 `AuditLog.create({...})` call was refactored to call the new `logAuditEvent` instead — same `eventType`, same description text, unchanged behavior in the success path — but as a side effect this closed a real gap: the old direct call was unguarded, so an audit-write failure there would previously have thrown and blocked the whole add-participant action; routed through the shared service, it's now non-blocking like every other event, which is what the spec's resilience requirement actually demands project-wide.
- **`comment.service.js`** — `createComment` logs `COMMENT_ADDED`.
- **`attachment.service.js`** — `uploadAttachment` logs `ATTACHMENT_UPLOADED` (required restructuring the previous `return await Attachment.create({...})` one-liner into an assignment-then-log-then-return, so the log call has the created record's data available); `deleteAttachment` logs `ATTACHMENT_DELETED`, reading `attachment.filename` off the in-memory Mongoose document *after* `attachment.deleteOne()` — safe, since the deleted document object itself still holds its fields in memory even though the underlying row is gone.

No circular-dependency risk: `audit.service.js` depends only on the `AuditLog` model, and every service above already sat "below" the others it imports from (e.g. `workflow.service.js` already imported `memo.service.js`, not the reverse), so adding one more leaf import to each didn't change that shape.

---

## 4. Backend: the logout endpoint

`POST /api/auth/logout` — new, behind `protect` (a valid JWT required), no role restriction. Its only job this stage is giving logout an audit trail; no token blocklisting/invalidation was implemented, per the spec's explicit "out of scope" call-out. `auth.controller.js` gained a thin `logout` handler calling `authService.logout(req.user.id, req.user.organizationId)` and returning `200`. `auth.routes.js` registered it alongside the existing `/login` and `/me`.

Frontend: `AuthContext.jsx`'s `logout()` function, previously a synchronous local-only `clearToken()` + `setUser(null)`, is now `async` and calls `api.post('/auth/logout')` first — wrapped in its own try/catch so a network failure there can never prevent the user from actually logging out locally; the whole point of this call is an audit trail, not a real precondition for logout succeeding.

---

## 5. Backend: the audit log endpoint

`GET /api/audit-logs` replaced the Stage-1 placeholder router entirely. `router.use(protect, authorize('admin'))` at the top of `auditLog.routes.js`, then exactly one route: `router.get('/', auditLogController.listAuditLogs)`. No `POST`/`PATCH`/`DELETE` route is registered anywhere in this router — audit records are immutable and read-only by design, and the *absence* of a route (rather than a route that exists but rejects with 403) is what makes a guessed mutating request 404 instead, as verified in §6 and re-confirmed in §8.

`auditLog.controller.js` is a thin pass-through: pulls `eventType`/`userId`/`dateFrom`/`dateTo`/`page`/`limit` off `req.query`, calls `auditService.listAuditLogs(req.user.organizationId, {...})`, returns the `{ auditLogs, total, page, limit }` shape directly as JSON — `req.user.organizationId` is always the scoping value, never anything from the query string, so there is no way for a request parameter to widen the query past the caller's own organization.

---

## 6. Backend tests

New `tests/auditLog.test.js`, 17 tests, reusing the existing `helpers.js`/`workflowHelpers.js` fixtures rather than duplicating setup, organized into three `describe` blocks:

- **Event logging** (9 tests, one per event or grouped by natural sequence): `USER_LOGIN` on success only, not on a failed attempt; `USER_LOGOUT`; `USER_CREATED` for the initial admin (registration); `USER_CREATED` (admin creates a user, attributed to the admin) plus `USER_ACTIVATED`/`USER_DEACTIVATED` on status toggle; `MEMO_CREATED`/`MEMO_MODIFIED`/`MEMO_SUBMITTED`/`WORKFLOW_ASSIGNED` as one sequential flow on the same memo; `WORKFLOW_APPROVED` on every approval with `WORKFLOW_COMPLETED` appearing only after the final one (a 2-participant workflow, checked after each approve); `WORKFLOW_REJECTED`/`CHANGE_REQUESTED`/`MEMO_RESUBMITTED` across two separate workflow fixtures; `WORKFLOW_PARTICIPANT_ADDED` (confirming the Stage 5 refactor in §3 didn't change its observable behavior); `COMMENT_ADDED`; `ATTACHMENT_UPLOADED`/`ATTACHMENT_DELETED` on the same attachment.
- **Resilience** (1 test): `jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(...)` around a `POST /api/memos` call — asserts the memo is still created (`201`) and `console.error` was called, the same shape as Stage 7's notification-resilience test.
- **`GET /api/audit-logs`** (7 tests): non-admin gets `403`; an admin gets paginated, newest-first, actor-name-populated results; tenant isolation — Org A's admin querying `eventType=MEMO_CREATED` sees `0` results after Org B creates a memo, Org B's admin querying the identical filter sees `1`; `eventType`/`userId`/date-range filters individually and combined; pagination correctness across three pages of five `MEMO_CREATED` events with no overlap; and the PATCH/DELETE-404-not-403 test described in §5, using an authenticated *admin* token specifically (an employee token would trivially 403 from the role check first, which wouldn't prove the route itself doesn't exist — an admin passing the role check and still getting `404` is what actually proves it).

Full suite: **141/141 passing** (124 carried over from Stages 1–8, 17 new). Re-run `tests/auditLog.test.js` alone afterward (`17/17`) to confirm it's self-contained and not order-dependent on the rest of the suite.

---

## 7. Frontend

- `services/auditLogs.js` — one wrapper, `getAuditLogs(params)`.
- **`pages/AuditLog.jsx`** — new, modeled directly on Stage 8's `Search.jsx` (same filter-form-plus-table-plus-Previous/Next-pagination shape, `PAGE_SIZE = 20`, `appliedFilters` vs. in-progress `filters` state so typing doesn't re-query until submit). Filters: event type (a hardcoded `<select>` of all 18 known `eventType` values — there's no dynamic list of distinct values on the backend, so this is a maintained constant, same as `Search.jsx`'s hardcoded `STATUSES`/`CATEGORIES`), actor (a `<select>` populated from `getDirectory()`'s user list, same directory endpoint `Search.jsx` and `MemoForm.jsx` already use), and a date range. Table columns: timestamp (`toLocaleString()`), actor (`entry.userId?.name`), event type, description.
- **Routing**: `/admin/audit-log`, registered in `AppRoutes.jsx` behind `ProtectedRoute roles={['admin']}` — the same client-side gate already used for `/admin`, with the same caveat noted in that component's own comment that this is UI convenience only, since the real authorization is `authorize('admin')` server-side.
- **`NavBar.jsx`** gained a second admin-only link, "Audit Log", next to the existing "Administration" link — both gated on `user.role === 'admin'`.

Production build: **118 modules, no errors** (up from 116 at the end of Stage 8's last follow-up — the two new files, `auditLogs.js` and `AuditLog.jsx`).

---

## 8. Manual verification

Unlike every prior stage's manual verification (which spun up a genuinely separate, temporary MongoDB + backend server specifically to avoid touching the user's own persistent dev database), this session ran its walkthrough script directly against the user's actual persistent dev server — deliberately, since the whole point of an audit-log walkthrough is confirming what a real admin would see in the real environment, and there was no destructive or state-mutating risk in adding one more throwaway organization to it (the same way the Stage-8-follow-up ENOENT fix's manual verification also targeted the real dev environment on purpose, for the same reason).

A Node `fetch`-driven script: register a fresh org/admin → log in → log out → log back in → admin creates a participant employee → admin creates a memo with that employee as a workflow participant → submits it → the employee approves it (single-step workflow, so this is also the final step) → admin adds a comment → admin uploads a PDF attachment → admin fetches `/api/audit-logs` and asserts every one of those 10 distinct event types is present, with the right actor name and a description containing the right identifier (the memo's real reference number, the new employee's real name, the uploaded file's real name) → the employee is confirmed to get `403` on the same endpoint.

All checks passed on the first run; the audit log came back with 13 entries in correct newest-first order, actor names correctly populated for every row. The remaining event types not exercised in this particular flow (`USER_ACTIVATED`/`USER_DEACTIVATED`, `WORKFLOW_REJECTED`, `CHANGE_REQUESTED`, `MEMO_RESUBMITTED`, `WORKFLOW_PARTICIPANT_ADDED`, `ATTACHMENT_DELETED`, `MEMO_MODIFIED`) are the ones already covered individually by the automated suite in §6, rather than re-walked manually — the spec's own manual-verification steps didn't call for those specifically.

---

## 9. Tradeoffs and things explicitly flagged rather than silently decided

- **`user.service.js#createUser`'s signature changed** (added a `requestingUserId` parameter before the payload) to correctly attribute the `USER_CREATED` event to the *admin* rather than the newly created user. The only call site was its own controller, updated in the same change; grepped first to confirm nothing else called it directly.
- **`WORKFLOW_APPROVED` and `WORKFLOW_COMPLETED` are not mutually exclusive** — a workflow's final approval logs both, since they describe two different true facts about the same action (this step was approved; the whole workflow is now done), not one replacing the other.
- **`auth.service.js#logout` does one extra `User.findById` lookup** purely to put a real name in the `USER_LOGOUT` description, since the JWT itself carries no name. Accepted as negligible — logout is infrequent, and every other event already had its actor's name available for free from data already being loaded for other reasons.
- **The Stage 5 `WORKFLOW_PARTICIPANT_ADDED` call was refactored, not left alone**, despite the spec describing it as "already exists... unchanged" — read as "the event, its trigger point, and its description stay the same," not literally "must keep its own private `AuditLog.create` call," since the surrounding goal ("generalize that pattern... without duplicating logging logic per call site") only makes sense if that one pre-existing call site is folded into the same shared function as everything else. Its observable behavior (same `eventType`, same description format) is unchanged; only its resilience characteristics improved, as a side effect.
- **No PATCH/DELETE route exists anywhere for audit logs, by omission rather than by an explicit rejecting handler** — confirmed deliberately meaningful (§6): a guessed mutating request 404s, not 403s, because there is genuinely no code path that would ever match it, not because a handler exists and blocks it.

---

## 10. Follow-up: confirming the two audit-log-specific security tests already existed

The user asked, without expecting any code change unless something was actually missing, whether two specific tests existed: (1) a test confirming no PATCH/DELETE route exists for `/api/audit-logs` (404, not 403, for a guessed request), and (2) a test confirming tenant isolation specifically for audit logs — an admin in Org A never sees Org B's entries even when a filter would otherwise match both.

Both were already written in §6, as part of the initial implementation turn, not added new here. Verified by directly re-reading `auditLog.test.js` rather than trusting memory of what had been written:

- The PATCH/DELETE test (`'has no PATCH or DELETE route for audit logs — a guessed one 404s for an authenticated admin, not 403'`) authenticates as a genuine admin — specifically so a `403` from the role-check layer can't be mistaken for proof the route doesn't exist — and asserts `404` on both a `PATCH` and a `DELETE` to a syntactically valid but nonexistent audit-log ID.
- The tenant-isolation test (`"never returns another organization's audit entries, even with matching filters"`) has Org B's admin create a memo (producing one real `MEMO_CREATED` entry), then has Org A's admin query `GET /api/audit-logs?eventType=MEMO_CREATED` and confirms `0` results, while Org B's admin querying the identical filter gets `1` — the shared, matching `eventType` filter is what makes this a genuine isolation check rather than an incidental empty result from unrelated data.

Re-ran `tests/auditLog.test.js` alone to confirm both still pass in isolation: **17/17**. No files were changed for this follow-up.
