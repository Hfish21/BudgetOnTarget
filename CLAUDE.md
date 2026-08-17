# CLAUDE.md — BudgetOnTarget

> This file is Claude Code's project guide and stays the richest reference. A condensed, vendor-neutral version for other agents (Codex, Cursor, Copilot, etc.) lives in [AGENTS.md](AGENTS.md) — keep the two consistent when changing setup steps, guardrails, or architecture.

## What This Is
Personal household budget dashboard. Users import bank CSVs, categorize transactions via rules, set monthly spending targets, and track progress. Runs entirely in the browser as a PWA — no server, no database, no accounts. Live at **budgetontarget.com**.

Data lives in a `.budget` JSON file the user saves to their own disk, with IndexedDB auto-save as the crash-safety net.

## Architecture

Everything is in `frontend/`. There is no backend.

> This was a full-stack app (FastAPI + SQLAlchemy + SQLite) until 2026-05-28, when `6249e7d` ported the backend to TypeScript for browser-only operation. The Python code was removed once it had drifted two features behind; it is recoverable from git history at `c955a82`.

### Frontend (`frontend/`)
- **Framework**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Static export**: `next.config.ts` sets `output: "export"` — `pnpm build` produces `out/`
- **Routing**: the marketing landing page is the site root (`src/app/page.tsx`); the budget app lives under `/app/*` (`src/app/app/`). The root layout holds only fonts and metadata — `StorageProvider`, `PrivacyProvider`, and `AppShell` mount in `src/app/app/layout.tsx`, so the landing page carries none of them. The six pre-`/app` URLs are redirect stubs kept for existing bookmarks and installed PWAs.
- **Adding an app route**: create it under `src/app/app/`, and add it to `navItems` in `sidebar.tsx` and to `APP_SHELL` in `public/sw.js`
- **API seam** (`src/lib/api.ts`): exports `api`, which is `localApi`. Components import `api` and call async methods; the asynchrony is deliberate, so the seam stays backend-shaped if a hosted mode ever returns.
- **Local engine** (`src/lib/local-engine/`) — the entire application core:
  - `store.ts` — in-memory data store with CRUD, dirty tracking, subscriber pattern
  - `target-engine.ts` — budget assessments, cumulative daily tracking, lane/target history
  - `debt-engine.ts` — Debt Trajectory: credit-card payoff projection from a single-statement anchor. A linked card account drives the real balance (charges raise it, payments lower it); the forward projection uses APR + a future-spend assumption (stop-charging vs keep-spending). Exposes on-track/ahead/behind status and extra-payment scenarios (pure money math)
  - `categorizer.ts` — rule matching (substring/regex), bulk recategorization
  - `csv-parser.ts` — USAA CSV format parser with sign normalization
  - `csv-parser-generic.ts` — any-bank parser driven by a user-supplied column mapping
  - `importer.ts` — dedup, auto-categorize, internal transfer detection, pending overlay
  - `hasher.ts` — SHA-256 via Web Crypto API
  - `local-api.ts` — the API surface components call
  - `file-io.ts` — File System Access API (Chromium) with fallback, IndexedDB auto-save
  - `types.ts` — TypeScript interfaces for the `.budget` JSON schema
- **Google Drive backend** (`src/lib/drive/`) — optional cloud storage for the `.budget` file, so one canonical file is reachable from any machine. Still 100% browser-only: the browser talks straight to Google, no BudgetOnTarget server is ever in the path.
  - `google-drive.ts` — Google Identity Services (implicit token flow, **no client secret**), the Google Picker as the "Open" dialog, and Drive REST for download/create/update. In-memory access token with silent refresh; conflict guard compares Drive `modifiedTime` before overwriting.
  - `config.ts` — the OAuth Client ID + Picker API key. **These are public by design and committed** (there is no secret in the implicit flow; the API key is referrer-locked to `budgetontarget.com` + `localhost:3000` and to the Picker API). `NEXT_PUBLIC_GOOGLE_*` env vars override them for a fork. Uses the `drive.file` scope (app only sees files the user picks or that it creates). Google Cloud project: `budgetontarget`.
- **Storage provider** (`src/components/storage-provider.tsx`): the storage state machine. Tracks a single canonical **location** (`none`/`local`/`drive`) surfaced in the sidebar, so the source of truth is never ambiguous. Open and Save each offer "This device" and "Google Drive" (see `layout/storage-controls.tsx`); choosing one makes it canonical and subsequent saves write back there. Also: IndexedDB auto-persist (2s debounce, content + location + Drive-ref/local-handle, never the token), Drive save-time `modifiedTime` conflict resolution, focus-triggered multi-device refresh (silent when clean, banner when there are local edits), and a `dataVersion` counter components watch to re-fetch after store mutations
- **PWA**: `public/manifest.webmanifest`, `public/sw.js` (stale-while-revalidate; ignores cross-origin requests, so Google's scripts/API pass straight through), icons in `public/`

### `.budget` File Format
Single JSON file (`version: 3`) containing all entities: accounts, members, categories, rules, targets, transactions, imports, tags, debts. Integer IDs for internal references. (`debts`, for Debt Trajectory, was added in v2; v3 added `debt_id` on targets, linking a "pay toward a card" target to its debt. Older files still open — `load()` backfills `debts: []` and `debt_id: null`.)

**Changing this schema requires bumping `CURRENT_VERSION` in `store.ts` and handling the old shape in `load()`.** Existing files in the wild must keep opening — `load()` already backfills `is_excluded` and `is_pending` for files that predate them; follow that pattern.

## Safety Rules — READ THESE

- **NEVER** commit or push any `.budget` file — these contain real financial data (gitignored, keep it that way)
- **NEVER** delete or move `backend/budgetontarget.db`, `backend/*.db-wal`, `backend/*.db-shm`, or anything in `backups/` — these are untracked leftovers from the full-stack era that still hold real financial data. They are gitignored and no longer used by the app, but they are Hayden's to delete, not yours.
- Treat any file matching `*.budget` or `*.db` as real financial data unless proven otherwise

## Git Workflow
- Feature branches off `main` (`feature/*`, `fix/*`, `chore/*`)
- Clean, imperative-mood commit messages
- Push after every meaningful commit
- PR via `gh pr create` before merging — never merge without approval

## Development

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:3000, hot reload
pnpm build      # static export → out/  (also the strictest check: full TS pass)
pnpm preview    # serve the built output
pnpm lint
```

There is no backend to start and no database to migrate.

## Testing Changes Before Deploy

There is **no automated test suite** — `target-engine.ts`, `importer.ts`, and `categorizer.ts` do real money math with no coverage. Verify manually:

1. `cd frontend && pnpm build` — must succeed; the static export catches most type and prerender issues
2. `pnpm preview` and exercise the change in the browser against a real `.budget` file
3. Commit, push, and confirm the GitHub Actions run passes

If you touch the engine's money math, adding tests alongside is worth proposing.

## Deploying to Production

The site deploys automatically to **budgetontarget.com** via GitHub Pages when `main` is updated.

**Automatic**: push/merge to `main` → GitHub Actions builds the static site → deploys to Pages.

**Manual trigger**: `gh workflow run "Deploy to GitHub Pages"` or use the Actions UI.

**Workflow**: `.github/workflows/deploy-pages.yml` — pnpm install → next build → upload `frontend/out/` → deploy to Pages.

**Verify**: `curl -sI https://budgetontarget.com` should return HTTP 200. Check the Actions tab for build logs.

**Custom domain**: `budgetontarget.com` is configured in GitHub Pages settings with HTTPS. No `basePath` needed — the domain serves from root.
