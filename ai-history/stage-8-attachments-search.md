# AI Session History — Stage 8: File Attachments and Search

**Project:** Inter-Office Memo Management System (CSE226)
**Tool:** Claude Code
**Scope of this session:** File attachments on memos (upload/list/download/delete, local disk storage) and organization-scoped search across memos with filters and pagination. Explicitly not: the Stage 9 reporting system, PDF export, new audit events, any change to the workflow engine/comments/notifications from Stages 5–7.

---

## 1. Starting point

Stages 1–7 confirmed complete (105 tests passing, the count at the end of Stage 7's own follow-ups) before writing anything. Checked directly rather than assumed: no `Attachment` model existed yet (Stage 1's models were `Organization`, `Department`, `User`, `Memo`, `WorkflowStep`, `Comment`, `Notification`, `AuditLog`, `MemoCounter` — no attachment placeholder at all, unlike comments/notifications which had Stage-1 model+route placeholders waiting to be filled in). No `attachment.routes.js` placeholder existed either. `multer` was not yet a dependency.

**Routing decision, consistent with Stage 6/7's established convention**: attachments are memo-scoped resources, so they went in as `POST/GET /memos/:id/attachments`, `.../:attachmentId/download`, and `DELETE .../:attachmentId` inside the existing `memo.routes.js`, alongside the comment routes from Stage 7 — not a new standalone `/api/attachments` router. Search is also memo-scoped conceptually (`GET /memos/search`), registered ahead of `GET /:id` for the same reason `/mine`, `/inbox`, and now `/search` all have to be — Express would otherwise capture `search` as an `:id` value.

This session also found the project already had real git history (contrary to an earlier assumption in this same overall working session) — checked `git status`/`git log` before touching anything, confirmed the previous turn's uncommitted Register-page work was still sitting there, and left it alone rather than disturbing it, since committing wasn't asked for.

---

## 2. Dependency: multer

`npm install multer` initially pulled `1.4.5-lts.2`, which printed an explicit deprecation warning: "Multer 1.x is impacted by a number of vulnerabilities, which have been patched in 2.x." Rather than ignore that and move on, the package was uninstalled and reinstalled pinned to `^2`, landing on `2.2.0`. `npm audit` afterward showed 2 pre-existing vulnerabilities (critical/high) — traced to `tar`, a transitive dependency of `@mapbox/node-pre-gyp`, which comes from `bcrypt`'s native-build toolchain, not from multer. Confirmed this was pre-existing (present before this session touched anything) rather than something the attachments work introduced, and left it alone — `npm audit fix` on an unrelated, already-working native dependency chain (`bcrypt`) was judged out of scope for this stage and risky to touch without being asked.

---

## 3. Backend: attachments

### Model

New `Attachment.js`: `memoId`, `organizationId`, `filename` (original, display-only), `storedFilename` (server-generated, unique), `size`, `mimetype`, `uploadedBy`, `uploadedAt` (explicit field, alongside the schema's own `timestamps`, matching the spec's literal field list and the precedent of `Memo.submittedAt` being its own explicit field rather than overloading `createdAt`).

### Upload pipeline and content validation

`middleware/upload.js` (new, alongside `auth.js`/`role.js` in the existing middleware directory) configures multer with **memory storage**, not disk storage — deliberately, so a file that fails content validation never touches disk at all. It also wraps multer's own errors (which aren't `ApiError` instances and would otherwise 500 via the generic handler) into a clean `400`, specifically translating `LIMIT_FILE_SIZE` into a readable "exceeds the maximum allowed size of 10MB" message.

`attachment.service.js` (new) holds the actual validation: an `ALLOWED_TYPES` table mapping each of the seven allowed extensions (pdf, doc, docx, xls, xlsx, png, jpg/jpeg) to its expected magic-byte signature. `detectAllowedType` only accepts a file if **both** the extension is allowlisted **and** the buffer's leading bytes match that type's signature — an extension-only or Content-Type-only check would have been insufficient per the spec's explicit "validate actual content, not just extension/declared Content-Type."

**A limitation flagged rather than glossed over**: legacy `.doc`/`.xls` share the same outer OLE-compound-file signature, and `.docx`/`.xlsx` share the same outer zip signature — so a renamed `.xls`→`.doc` (or `.xlsx`→`.docx`) would still pass. Telling them apart would require parsing into the container format, not just reading its first bytes. Documented in a code comment on `ALLOWED_TYPES` as the practical limit of signature-only checking, matching the spec's own "where practical" qualifier rather than silently treating the check as airtight.

On success, the file is written to `backend/uploads/` (created via `fs.mkdirSync(..., { recursive: true })` at module load) under a `crypto.randomUUID()`-based name with the validated extension — never the client-supplied original filename — before the `Attachment` record is created. If the DB write fails after the disk write succeeds, the just-written file is deleted to avoid an orphan.

### Authorization

`assertCanAccessAttachments` mirrors Stage 7's comment-authorization pattern exactly (author, or anyone holding any `WorkflowStep` regardless of status) — duplicated locally rather than importing Stage 7's private, unexported helper out of `comment.service.js`, to avoid touching already-shipped Stage 7 code per "do not restructure what already exists." `assertCanDeleteAttachment` is separate and narrower: uploader or memo author only, independent of the broader view-access check (every uploader already had view access to upload in the first place, so no redundant check was added before it).

### Download safety

The download endpoint never accepts a path or filename from the request — `attachmentId` is used purely to look up the `Attachment` document (already scoped by `organizationId` and authorization), and the actual disk path is built entirely from that record's server-generated `storedFilename`, joined against a fixed, absolute `UPLOADS_DIR`. There is no code path where a value from the URL reaches the filesystem directly, which is what makes "can't be reached by guessing a filename or path" true by construction rather than by an added guard — verified with a dedicated test (§5) using a *genuinely valid* attachment id that belongs to a *different* memo the same user legitimately has access to, confirming the memo/attachment pairing itself is enforced, not just organization/authorization.

The `uploads/` directory is never mounted as static/public — it's read only through `res.download()` inside the authorized controller action.

---

## 4. Backend: search

`memo.service.js` gained `searchMemos`. The visibility rule is built as one `$and` array combining `{ organizationId }`, a visibility `$or` (`authorId` matches, or the memo's `_id` is in the set of memoIds the user holds any `WorkflowStep` on — computed via `WorkflowStep.find({ userId }).distinct('memoId')`), and then each optional filter (`status`, `category`, `priority`, `department` → `departmentId`, a `createdAt` date range) and the text search as additional `$and` members. Deliberately not a second, independent top-level `$or` — combining everything through one `$and` array means the visibility clause can never be accidentally widened by whatever else the caller passed in `q` or the filters; every clause narrows the result set, none can expand past what the visibility clause alone allows.

`q` searches `subject`, `body`, and `referenceNumber` via a case-insensitive regex, with the input escaped through a small `escapeRegex` helper first — untrusted user input was going straight into a MongoDB regex, so this was treated as a real (if minor) hardening step, not optional polish.

Pagination: `page`/`limit` (default 1/20, both floored at 1), `Memo.countDocuments(filter)` run against the *same* filter object used for the paginated `.find()`, so `total` is always consistent with what pagination is actually paging over.

---

## 5. Backend tests

Two new files, `attachments.test.js` (10 tests) and `search.test.js` (7 tests), both reusing the existing `tests/workflowHelpers.js` fixtures rather than duplicating setup:

- **Attachments**: author/participant/bystander/cross-org authorization on upload; oversized-file rejection; disallowed-extension rejection; a dedicated **content-mismatch** test (a file named `fake.pdf` containing plain text — proves the magic-byte check, not just the extension allowlist, is what's rejecting it, and that no `Attachment` record was created); list shape (filename/size/uploader name/date, chronological); upload/delete each independently verified to leave `memo.status` untouched; download authorization (same author/participant/bystander/cross-org matrix) plus the cross-memo-attachment-id test described above; delete authorization (uploader-only, author-only, a *different* participant rejected).
- **Search**: matches by each of subject/body/referenceNumber independently; the core security requirement — a memo matching `q` that the searching user is not the author of and has no `WorkflowStep` on is confirmed absent from their results, with a same-request sanity check that `GET /memos/:id` on that same memo also 403s for that same user, so the test is pinned to the actual authorization invariant rather than just an empirical result; a participant (not the author) can still find a memo via search; each filter individually and combined; date-range filtering; pagination correctness including a check that three pages of a 5-item, limit-2 search never overlap or duplicate; cross-organization exclusion even when the query text would otherwise match.

Real file uploads in these tests write to the actual filesystem (memory storage in multer, but the service layer's `fs.promises.writeFile` is not mocked) — deliberately, so the tests exercise the real disk-write/read/delete path rather than a simulated one. This surfaced a real gap: **the shared `tests/setup.js` had no cleanup for anything outside MongoDB**, so every test run was leaving real orphaned files behind in `backend/uploads/`, accumulating indefinitely across repeated runs. Fixed by adding an `fs.rmSync(uploadsDir, { recursive: true, force: true })` to the existing `afterAll` hook in `tests/setup.js` (which already tears down the in-memory Mongo instance) — verified by re-running the full suite and confirming the `uploads/` directory no longer exists once the run completes. This is an extension of Stage 8's own newly-introduced test infrastructure gap, not a modification of any prior stage's established test behavior.

**Full suite result: 122/122 passing** (105 carried over from Stages 1–7, 17 new). Re-run a second time after the `tests/setup.js` fix, specifically to confirm the fix itself didn't break anything and that the cleanup actually took effect — same pass count, and the uploads directory confirmed gone afterward.

---

## 6. Frontend

- `services/attachments.js` — `getAttachments`, `uploadAttachment` (builds a `FormData`, overrides the shared axios instance's default `application/json` Content-Type), `deleteAttachment`, and `downloadAttachment`. The download function is the one non-trivial piece: this app authenticates via a bearer token in `localStorage` (no cookie session), so a plain `<a href>` can't carry the `Authorization` header a protected download endpoint requires. `downloadAttachment` instead fetches the file through the normal authenticated axios instance with `responseType: 'blob'`, then triggers the actual browser save via a throwaway `URL.createObjectURL` + synthetic `<a>` click — the standard pattern for authenticated file downloads in a token-based SPA, verified working end-to-end in manual verification (§7), not just assumed to work.
- `services/search.js` — one wrapper.
- **`components/AttachmentsSection.jsx`** — list (filename as a clickable download trigger, size/uploader/date), upload control gated on a `canUpload` prop, per-attachment delete button gated on `isAuthor || attachment.uploadedBy._id === currentUserId` computed per row (not a single page-level flag, since different attachments in the same list can have different uploaders).
- **`pages/Search.jsx`** — search box, the five filter controls (status/category/priority/department/date range), a results table matching the spec's stated columns (reference/subject/status/priority), Previous/Next pagination reading `total`/`page`/`limit` from the response.
- `MemoDetail.jsx` gained `<AttachmentsSection>`, passed `canUpload={canComment}` — reusing the exact same boolean Stage 7 already computes for comment visibility, since the spec states attachments use "the same rule as comments" and Stage 7 had already resolved the one subtlety in that rule (author included even without a `WorkflowStep`, no status restriction) — recomputing a parallel `canUpload` from scratch would have risked silently drifting from that already-settled rule instead of reusing it exactly.
- `NavBar.jsx` gained a "Search" link; `AppRoutes.jsx` gained `/search`, behind the existing `ProtectedRoute` with no role restriction.

Production build: **116 modules, no errors** (up from 112 at the end of the prior session's Register-page addition).

---

## 7. Manual verification

Run against a genuinely separate, temporary MongoDB + backend server (not the persistent local dev database already running for the user's own manual browser testing from earlier in this session) — driven by a Node script using `fetch`, including real `FormData`/`Blob` multipart uploads, not just JSON calls:

Org + admin + one participant + one uninvolved bystander created → a memo submitted with the participant on its workflow, subject deliberately containing a unique searchable string → **author uploads a PDF and a PNG**, both `201` → **the participant lists and downloads** the PDF, confirmed the downloaded bytes are byte-identical to the original upload → **the bystander** gets `403` on both listing and downloading the same attachment → a disallowed `.sh` file rejected with `400` and a clear message → an 11MB file rejected with `400` and a clear "exceeds... 10MB" message → **search for the unique subject string** returns the memo for the author, and returns nothing for the bystander even though the same query text would otherwise match. All steps passed on the first run. Frontend `npm run build` confirmed clean separately.

**Cleanup**, applying the lesson from Stage 6/7's own postmortems a third time rather than re-learning it: after stopping the temporary mongo/server tasks, `Get-Process` cross-referenced against `Get-NetTCPConnection` confirmed neither temporary process's port was still listening — and, new for this stage, the attachment test files this same script had written to the shared `backend/uploads/` directory were also explicitly deleted, since (unlike prior stages) this stage's manual verification leaves real files on disk, not just database state.

---

## 8. Tradeoffs and things explicitly flagged rather than silently decided

- **Local disk storage for attachments** (as explicitly asked) means uploaded files live at `backend/uploads/`, outside of MongoDB. **This will not survive a typical redeploy** on most hosting platforms — a fresh container/instance boot has an empty local filesystem, so every attachment ever uploaded would become unreachable (the `Attachment` metadata rows would still exist in Mongo, pointing at `storedFilename`s that no longer exist on the new instance's disk) the moment the app is redeployed anywhere without a persistent volume or is horizontally scaled across multiple instances (each with its own local disk, so an upload landing on instance A wouldn't be visible from instance B). Flagging this now, explicitly, for Stage 10: whatever hosting setup is chosen there needs either a persistent/shared volume mounted at `uploads/`, or a swap to object storage (S3-compatible or similar) before this stage's implementation can be trusted in production. Nothing in this stage's code assumes a fix is already in place — the tradeoff is real and unresolved, on purpose, since fixing it wasn't in scope here.
- **Magic-byte validation can't distinguish `.doc` from `.xls`, or `.docx` from `.xlsx`, from raw bytes alone** (§3) — both pairs share their outer container format's signature. A full format-aware parser would close this gap; a signature check cannot, no matter how it's implemented.
- **`tests/setup.js` now also cleans `backend/uploads/`** (§5) — a deliberate, scoped addition to shared test infrastructure, made necessary by this stage's own tests being the first to touch the real filesystem, not a change to how any prior stage's tests behave.
- The pre-existing `tar`/`@mapbox/node-pre-gyp` vulnerability surfaced by `npm audit` (§2) was investigated and attributed to `bcrypt`, not multer, and deliberately left unaddressed as out of scope for this stage.
