# AI Session History — Stage 1: Project Foundation

**Project:** Inter-Office Memo Management System (CSE226)
**Tool:** Claude Code
**Scope of this session:** Monorepo foundation only (structure, Mongoose models, app skeletons, config). No auth, workflow, or business logic.

This document is a chronological record of the session: what was asked, what was tried, what failed or was corrected along the way, and what was verified before the stage was called done.

---

## 1. Initial request

The user asked for the **first development stage** of the project: a clean, production-style monorepo foundation, explicitly scoped to *not* include business logic, auth, workflow execution, or real UI. The request specified:

- Stack: React + Vite + Tailwind + React Router + Axios (frontend); Node + Express + MongoDB + Mongoose + JWT + bcrypt + dotenv + cors (backend).
- Monorepo with separate `frontend/` and `backend/` apps, each with a specific folder layout (`pages`, `components`, `layouts`, `services`, `context`, `routes` on the frontend; `config`, `models`, `controllers`, `routes`, `middleware`, `services`, `utils` on the backend).
- Eight Mongoose models with specific fields: `Organization`, `Department`, `User`, `Memo`, `WorkflowStep`, `Comment`, `Notification`, `AuditLog`.
- Backend foundation: Express app, server entry point, Mongoose connection config, dotenv, CORS, basic error handling, placeholder routes only.
- Frontend foundation: Vite + Tailwind + Router + Axios wired up, minimal entry point, no real pages.
- Explicit "do not implement" list covering auth, memo CRUD, workflow, comments, notifications, audit logging, search, reporting, PDF export, attachments, deployment, and seed data.
- A hard requirement: never create real secrets/credentials, and verify (not just assume) that both apps start, install cleanly, and that the backend can reach MongoDB with valid env vars.

---

## 2. Environment discovery

Before creating anything, the working directory was inspected:

```
ls -la "/c/Users/DELL/OneDrive/Desktop/inter office memo"
```

This revealed a directory already existed: `inter-office-memo-system/`. Rather than assume it was empty scaffolding, it was inspected further:

```
git log --oneline -20
git remote -v
git status
cat README.md
```

Findings:
- It was already a git repository, cloned from `https://github.com/sifatliza12-ux/inter-office-memo-system.git`, with one commit ("Initial commit") and a clean working tree.
- `README.md` contained only the repo title, nothing else.

**Decision:** build the monorepo inside this existing repo rather than creating a new sibling directory, since it already matched the project name and had no work at risk (clean tree).

Node/npm versions were also confirmed: `node v24.18.0`, `npm 11.16.0`.

---

## 3. Dependency version research (and a deliberate deviation from "latest")

`npm view <package> version` was run for every planned dependency to see what was actually current, rather than relying on memorized version numbers. This surfaced a few decisions:

- **Tailwind CSS**: latest was `4.3.3`, but Tailwind v4 drops the classic `tailwind.config.js` + `@tailwind` directive setup in favor of a CSS-first config. Since the user's spec explicitly asked for "Tailwind configuration" (i.e. a config file) and a familiar directive-based setup, **Tailwind v3 (`3.4.17`) was deliberately chosen over the newer v4** to match the requested structure.
- **Mongoose**: latest was `9.9.4`, but the well-established `8.x` line (`8.24.4`) was chosen instead, for ecosystem maturity and lower risk of undocumented breaking changes, despite Node 24 satisfying both.
- **Express**: pinned to the 4.x line (`^4.21.2`, resolving to `4.22.x`) rather than Express 5, since v5 has routing/middleware breaking changes and v4 remains the standard for this kind of foundation.
- **React / React Router / Vite**: after checking that current stable versions (React 19, React Router 7, Vite 8) had no blocking peer-dependency conflicts with each other, these were used as the "current, not legacy" choice, since the project is starting fresh today.

**Correction caught mid-edit:** while writing `frontend/package.json`, an initial edit set `vite` to `^6.0.7` — a version that didn't match what had actually been queried from the registry (`8.2.2`, paired with `@vitejs/plugin-react@6.1.0`). This was noticed immediately on review and corrected to `^8.2.2` / `^6.1.0` before any install was attempted, so it never reached a tested state.

---

## 4. De-risking bcrypt before committing to it

`bcrypt` is a native addon (requires a compiled binding), which is a common source of install failures on Windows without build tools. Before wiring it into the real backend, it was tested in isolation:

```
mkdir bcrypt-test && cd bcrypt-test
npm init -y
npm install bcrypt@5.1.1
```

Result: installed cleanly via a prebuilt binary (`node-pre-gyp`), 59 packages, no build step required. To confirm the binding actually *works* (not just downloaded):

```js
const bcrypt = require('bcrypt');
bcrypt.hash('test123', 10).then(h => bcrypt.compare('test123', h)).then(console.log);
```

Output confirmed a real hash and a successful compare. Only after this was `bcrypt` added to `backend/package.json`. The scratch test directory was deleted afterward.

Also checked (and found none) for any repo-level `.npmrc` that might alter install-script behavior (`allow-scripts` warnings appeared, but were confirmed to be pre-existing global npm/lavamoat config, not a project file, and did not block the install).

---

## 5. Directory scaffolding

Created the full folder structure for both apps:

```
backend/src/{config,models,controllers,routes,middleware,services,utils}
frontend/src/{pages,components,layouts,services,context,routes}
```

---

## 6. Backend implementation

Files created, in order:

- `backend/package.json` — scripts (`start`, `dev`), dependencies (express, mongoose, cors, dotenv, jsonwebtoken, bcrypt), devDependencies (nodemon).
- `backend/.env.example` — `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`/`JWT_EXPIRES_IN` (reserved, unused), `CLIENT_URL`. No real values.
- `backend/.gitignore` — `node_modules/`, `.env`, `*.log`.
- `src/config/db.js` — `connectDB()`, throws clearly if `MONGODB_URI` is missing, otherwise calls `mongoose.connect`.
- `src/middleware/notFound.js` and `errorHandler.js` — the "basic error-handling foundation" requested, kept generic (no business logic).
- `src/routes/*.routes.js` — one file per resource (`organization`, `department`, `user`, `memo`, `workflowStep`, `comment`, `notification`, `auditLog`), each just returning a placeholder JSON message on `GET /`.
- `src/routes/index.js` — mounts all eight under `/api/...`.
- `src/app.js` — Express app: CORS, JSON body parsing, `/api/health`, mounts `/api` routes, `notFound` + `errorHandler` last.
- `src/server.js` — loads dotenv, attempts `connectDB()`, **logs failure but does not exit the process**, then starts `app.listen` regardless.
- Eight Mongoose models under `src/models/`, matching every field in the spec, with:
  - `Organization`: embedded `contactInfo` subdocument, `subscriptionTier` enum, unique `identifier`.
  - `Department`: ref to `Organization`, compound unique index on `(organizationId, name)`.
  - `User`: refs to `Organization`/`Department`, `password` marked `select: false`, email format validation, compound unique index on `(organizationId, email)` (tenant-scoped uniqueness rather than global).
  - `Memo`: refs to `Organization`/`User` (author), `category`/`priority`/`status` enums.
  - `WorkflowStep`: refs to `Memo`/`User`, compound unique index on `(memoId, stepOrder)`.
  - `Comment`, `Notification`, `AuditLog`: refs and fields as specified, all with `timestamps: true`.
- `.gitkeep` placeholders added to the empty `controllers/`, `services/`, `utils/` folders so the required structure is visible even with no logic in it yet.

**Design decision worth flagging as a correction from the "obvious" pattern:** a stricter/more common pattern would fail fast (`process.exit(1)`) if MongoDB isn't reachable at startup. That was considered and rejected for this stage — the server is written to start and serve `/api/health` and placeholder routes even if Mongo is down, only logging the connection error. This was a deliberate choice so "backend can start" is independently verifiable from "backend can reach MongoDB," matching the two separate verification requirements in the brief.

---

## 7. Frontend implementation

Files created:

- `frontend/package.json` — React 19, React Router 7, Axios; devDependencies: Vite 8, `@vitejs/plugin-react` 6, Tailwind 3, PostCSS, Autoprefixer (see version-correction note in §3).
- `vite.config.js` — `@vitejs/plugin-react`, dev server on port 5173.
- `tailwind.config.js` — classic `content` globs over `index.html` and `src/**/*.{js,jsx,ts,tsx}`.
- `postcss.config.js` — `tailwindcss` + `autoprefixer`.
- `index.html` — root div + module script entry.
- `src/index.css` — the three `@tailwind` directives.
- `src/main.jsx` — `ReactDOM.createRoot`, wrapped in `BrowserRouter`.
- `src/App.jsx` — renders `AppRoutes`.
- `src/routes/AppRoutes.jsx` — a single placeholder route (`/`) rendering a centered heading, explicitly *not* real application UI.
- `src/services/api.js` — an Axios instance reading `VITE_API_BASE_URL` with a `localhost:5000/api` fallback.
- `.gitkeep` placeholders in the empty `pages/`, `components/`, `layouts/`, `context/` folders.
- `.env.example` — `VITE_API_BASE_URL`.
- `.gitignore` — `node_modules/`, `dist/`, `.env`, `*.log`.

A root-level `.gitignore` was also added at the repo root (mirroring the same patterns) since both apps live side by side.

---

## 8. Installing and building — first real verification pass

```
cd backend && npm install
```
→ 189 packages added, no errors. (2 vulnerabilities flagged, both transitive install-time dependencies of `bcrypt`'s `node-pre-gyp` toolchain — not runtime code, left as informational rather than "fixed" since acting on them wasn't requested and they don't affect the shipped app.)

```
cd frontend && npm install
```
→ 122 packages added, **0 vulnerabilities**.

```
cd frontend && npm run build
```
→ Succeeded:
```
dist/index.html                   0.42 kB
dist/assets/index-A0bOASAX.css    3.97 kB   (gzip 1.51 kB)
dist/assets/index-Bt6FfaJR.js   228.93 kB   (gzip 73.39 kB)
✓ built in 22.17s
```
The non-trivial CSS output size (3.97 kB, not near-zero) was the actual evidence that the Tailwind pipeline was wired correctly, not just present in config. The `dist/` output was deleted afterward — it's a build artifact, not part of the delivered foundation.

---

## 9. Runtime verification — frontend dev server

```
cd frontend && npm run dev   # backgrounded
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```
→ Vite reported "ready in 352 ms"; curl returned `200`. The dev server process was then killed (`taskkill /F /IM node.exe`).

---

## 10. Runtime verification — backend, including a failed first attempt

To test the backend's behavior against a real (if unreachable) Mongo URI, `.env.example` was copied to a temporary `backend/.env` (default `MONGODB_URI=mongodb://localhost:27017/...`, which is unreachable in this environment since no local MongoDB is running).

**First attempt failed:**
```
node src/server.js &   # backgrounded
sleep 4
curl http://localhost:5000/api/health
```
→ `curl: exit code 7` (connection refused) and an empty log file. The 4-second wait wasn't long enough for the log to flush / server to be confirmed up in this shell setup.

**Retried with a longer wait**, and got the real result:
```
MongoDB connection failed: connect ECONNREFUSED ::1:27017, connect ECONNREFUSED 127.0.0.1:27017
Server running on port 5000
```
```
curl http://localhost:5000/api/health   → {"status":"ok"}
curl http://localhost:5000/api/memos    → {"message":"Memo routes placeholder"}
curl http://localhost:5000/api/organizations → {"message":"Organization routes placeholder"}
curl -w "%{http_code}" http://localhost:5000/api/does-not-exist
  → {"message":"Route not found: /api/does-not-exist"}  HTTP 404
```
This confirmed the intended resilience: the API comes up and serves placeholder routes and health checks even when MongoDB is unreachable, instead of crashing. The test node process was then killed.

---

## 11. Full database round-trip verification (the "valid environment variables" case)

No local MongoDB or Docker was available in this environment (`docker`/`mongod` were checked and neither was found), so a **temporary, throwaway** verification project was set up outside the repo, in the scratch/temp directory, using `mongodb-memory-server` — installed only there, never added to the real project's dependencies.

A script (`verify.js`) was written that:
1. Starts an in-memory MongoDB and points `MONGODB_URI` at it.
2. Requires the **actual** backend's `connectDB` and all eight actual model files (via their real path in the repo) — not copies — so the test exercises the real schema code.
3. Calls `connectDB()` and checks `mongoose.connection.readyState`.
4. Creates one document per model (`Organization` → `Department` → `User` → `Memo` → `WorkflowStep` → `Comment` → `Notification` → `AuditLog`), exercising every ref relationship.
5. Runs a `populate()` on a `Memo` across both `authorId` and `organizationId` to confirm refs resolve correctly.
6. Attempts to insert a **duplicate** `User` with the same `(organizationId, email)` to confirm the compound unique index actually rejects it.
7. Disconnects and stops the in-memory server.

Output:
```
CONNECTED: true
ALL_MODELS_SAVED_OK
POPULATE_OK: true
UNIQUE_INDEX_ENFORCED: true
DISCONNECTED_CLEANLY
```

This was the strongest evidence that the models are not just syntactically valid but functionally correct against a real MongoDB engine. The entire scratch verification project (including `mongodb-memory-server` and `verify.js`) was deleted afterward — it left no trace in the delivered repo.

---

## 12. Cleanup and final structural check

- Deleted the temporary `backend/.env` created only for the unreachable-Mongo test, so the repo ships only `.env.example` files.
- Deleted stray log files written during testing.
- Ran a full `find` over the repo (excluding `node_modules` and `.git`) to review the final tree.
- Explicitly searched for any `.env*` file to confirm only `.env.example` files exist (no real or placeholder secrets left behind).
- Explicitly re-checked for the `.gitkeep`/`.gitignore` files, since an initial plain `find | sort` pass didn't print them — a `find` display quirk, not a missing-file problem; a targeted `find -iname` confirmed all of them were present.
- Ran `git status`: everything (new `.gitignore`, `backend/`, `frontend/`) was untracked; nothing was staged or committed, since committing wasn't requested.

---

## 13. Interruption and a paused step

While updating `README.md` (which at that point still only had the repo title), an attempt to `Read` the file was **denied by the user's permission system** mid-action. Rather than retry or guess at the content, the work stopped there and reported back.

The user then sent a few short, ambiguous follow-ups in quick succession ("Continue from where you left off," then "start?" which was itself interrupted, then "tell me your progress"). Instead of guessing what "start" meant or re-attempting the blocked action, a full recap of everything completed and verified so far was given, ending with a direct question: whether to proceed with the README update or leave it as-is.

---

## 14. Resuming and finishing

User: **"go ahead and finish."**

- `README.md` was read successfully this time (no permission block).
- It was rewritten from a single title line into a short foundation-stage README: project structure overview, backend setup/run commands, frontend setup/run commands, and an explicit "Status: foundation only" section pointing back to what's intentionally not yet built.
- Final `git status` was re-run to confirm the change was reflected (`README.md` modified, plus the same untracked `backend/`, `frontend/`, `.gitignore`) and that nothing had been committed.

A closing summary was given to the user listing every file created, every verification actually performed (not assumed), and the exact commands to run both apps.

---

## 15. This document

The user asked for this session to be exported as a chronological Markdown history, including the failed attempts and corrections above (the vite version slip, the first curl timing failure, the README read being denied), rather than a cleaned-up success-only narrative. Saved to `ai-history/stage-1-foundation.md`.
