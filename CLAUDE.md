# CLAUDE.md — BudgetOnTarget

## What This Is
Personal household budget dashboard. Users import bank CSVs, categorize transactions via rules, set monthly spending targets, and track progress. Runs entirely in the browser as a PWA — no server required. Live at **budgetontarget.com**.

## Architecture

### Two Modes
1. **Browser-only (PWA)** — Production mode. All logic runs client-side in TypeScript. Data lives in `.budget` JSON files the user saves locally. Deployed as a static site to GitHub Pages.
2. **Full-stack (dev)** — FastAPI + SQLAlchemy backend with SQLite, Next.js frontend. Used for Hayden's personal instance and development.

### Frontend (`frontend/`)
- **Framework**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Static export**: `next.config.ts` has `output: "export"` — `pnpm build` produces `out/` directory
- **API proxy** (`src/lib/api.ts`): Exports a `Proxy` object that delegates to either `remoteApi` (fetch-based, for full-stack mode) or `localApi` (in-memory, for PWA mode). Components import `api` — they don't know which mode they're in.
- **Local engine** (`src/lib/local-engine/`): Complete TypeScript port of the Python backend:
  - `store.ts` — In-memory data store with CRUD, dirty tracking, subscriber pattern
  - `target-engine.ts` — Budget assessments, cumulative daily tracking, lane/target history
  - `categorizer.ts` — Rule matching (substring/regex), bulk recategorization
  - `csv-parser.ts` — USAA CSV format parser with sign normalization
  - `importer.ts` — Dedup, auto-categorize, internal transfer detection
  - `hasher.ts` — SHA-256 via Web Crypto API
  - `local-api.ts` — Full API adapter matching remoteApi's shape
  - `file-io.ts` — File System Access API (Chromium) with fallback, IndexedDB auto-save
  - `types.ts` — TypeScript interfaces for the `.budget` JSON schema
- **Storage provider** (`src/components/storage-provider.tsx`): React context managing file open/save, IndexedDB auto-persist (2s debounce), `dataVersion` counter for reactivity
- **PWA**: `public/manifest.webmanifest`, `public/sw.js` (stale-while-revalidate), icons in `public/`

### Backend (`backend/`)
- **Framework**: FastAPI, SQLAlchemy ORM, Pydantic, Alembic migrations
- **Database**: SQLite with WAL mode at `backend/budgetontarget.db`
- **Key routes**: dashboard, transactions, categories, category_rules, targets, imports, accounts, household_members, budget_file (export/import)
- **Run**: `cd backend && uv run uvicorn app.main:app --reload --port 8000`

### `.budget` File Format
Single JSON file (v1) containing all entities: accounts, members, categories, rules, targets, transactions, imports, tags. Integer IDs for internal references. Designed for full round-trip fidelity with the SQLite database.

## Safety Rules — READ THESE

- **NEVER** delete/overwrite/move/truncate `backend/budgetontarget.db` or its WAL files
- **NEVER** run `docker compose down -v`
- **NEVER** run `alembic downgrade` without explicit approval
- **NEVER** run destructive SQL (DROP, DELETE, TRUNCATE) without explicit approval
- **NEVER** commit or push any `.budget` files or the SQLite database — these contain real financial data
- Run `./scripts/db-backup.sh` before any migration or schema work

## Git Workflow
- Feature branches off `main` (`feature/*`, `fix/*`)
- Clean, imperative-mood commit messages
- Push after every meaningful commit
- PR via `gh pr create` before merging — never merge without approval

## Development

```bash
# Frontend dev server (hot reload)
cd frontend && pnpm dev

# Backend dev server
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Build static site
cd frontend && pnpm build

# Serve static build locally
cd frontend && pnpm preview   # runs npx serve out
```

## Deploying to Production

The site deploys automatically to **budgetontarget.com** via GitHub Pages when `main` is updated.

**Automatic**: Push/merge to `main` → GitHub Actions builds the static site → deploys to Pages.

**Manual trigger**: `gh workflow run "Deploy to GitHub Pages"` or use the Actions UI.

**Workflow**: `.github/workflows/deploy-pages.yml` — pnpm install → next build → upload `frontend/out/` → deploy to Pages.

**Verify**: `curl -sI https://budgetontarget.com` should return HTTP 200. Check the Actions tab for build logs.

**Custom domain**: `budgetontarget.com` is configured in GitHub Pages settings with HTTPS. No `basePath` needed — the domain serves from root.

## Testing Changes Before Deploy
1. `cd frontend && pnpm build` — must succeed (static export catches most issues)
2. `pnpm preview` — test in browser at localhost
3. Commit, push, and verify the GitHub Actions run passes
