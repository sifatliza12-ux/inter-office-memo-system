# Inter-Office Memo Management System

CSE226 project. This is the foundation stage: monorepo structure, Mongoose models,
and app skeletons only. No auth, workflow, or business logic yet.

## Structure

```
backend/    Express + MongoDB API (models + placeholder routes only)
frontend/   React + Vite + Tailwind app (routing skeleton only)
```

## Backend

```
cd backend
npm install
cp .env.example .env   # then set MONGODB_URI to your own database
npm run dev             # nodemon, http://localhost:5000
```

`GET /api/health` returns `{ "status": "ok" }`. Each resource (`/api/organizations`,
`/api/departments`, `/api/users`, `/api/memos`, `/api/workflow-steps`, `/api/comments`,
`/api/notifications`, `/api/audit-logs`) currently returns a placeholder message —
no real logic is implemented yet.

## Frontend

```
cd frontend
npm install
cp .env.example .env    # optional, defaults to http://localhost:5000/api
npm run dev              # http://localhost:5173
```

## Status

Foundation only — see project instructions for what is intentionally not yet built
(authentication, memo workflow, comments, notifications, audit logging, etc.).
