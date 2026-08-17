# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) working in this repository. Human contributors: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is

BudgetOnTarget is a **browser-only budgeting PWA** — a static Next.js app with **no backend, no database, and no accounts**. Users import bank CSVs, categorize transactions via rules, set monthly spending targets, and track progress. Data lives in a user-held `.budget` JSON file plus IndexedDB auto-save. Live at [budgetontarget.com](https://budgetontarget.com), deployed as static files to GitHub Pages.

The entire application is in `frontend/`. Ignore the `backend/` folder if present — it is dead code from a retired full-stack version, not tracked in git, and nothing in it runs.

## Setup

Requires **Node.js 22** and **pnpm** (both version-pinned). pnpm ships with Node via Corepack — do not install it separately.

```bash
corepack enable          # provisions the pinned pnpm
cd frontend
pnpm install
pnpm dev                 # http://localhost:3000
```

Cross-platform: macOS, Linux, and Windows all work with the same commands (use PowerShell, Windows Terminal, or WSL2 on Windows). A `.gitattributes` normalizes line endings to LF, so do not "fix" CRLF/LF differences.

## Verify your changes (required before proposing a PR)

There is **no automated test suite.** The build is the verification gate — it is also the strictest type check. Run both from `frontend/`:

```bash
pnpm lint
pnpm build               # static export → out/; fails on any TS or prerender error
```

CI runs exactly these two commands on every PR. If both pass locally, CI will pass. If you touch money math, add tests alongside (see below).

## Where the code lives

```
frontend/src/
├── app/                    # Next.js routes: landing page at /, app under /app/*
├── components/             # UI (shadcn/ui on Base UI, Tailwind CSS 4)
└── lib/
    ├── api.ts              # the API seam — components call `api`; keep it async-shaped
    ├── drive/              # OPTIONAL Google Drive backend (browser↔Google, no server)
    │   ├── google-drive.ts     # GIS token flow (no secret) + Picker + Drive REST
    │   └── config.ts           # public, committed OAuth Client ID + Picker API key
    └── local-engine/       # THE APP CORE:
        ├── store.ts            # in-memory data store, CRUD, dirty tracking
        ├── target-engine.ts    # budget assessments, cumulative tracking  ← money math
        ├── debt-engine.ts      # credit-card payoff projection (Debt Trajectory) ← money math
        ├── importer.ts         # dedup, auto-categorize, transfers, pending ← money math
        ├── categorizer.ts      # rule matching                             ← money math
        ├── csv-parser.ts       # USAA format
        ├── csv-parser-generic.ts # any-bank via column mapping
        ├── file-io.ts          # FS Access API (reusable handle) + IndexedDB + location/handle/Drive-ref persistence
        └── types.ts            # the .budget JSON schema
```

**Storage location model.** `storage-provider.tsx` tracks one canonical location — `none` | `local` | `drive` — shown in the sidebar so the source of truth is explicit. Open and Save (in `layout/storage-controls.tsx`) each offer **This device** and **Google Drive**; picking one makes it canonical. Local "This device" uses a persisted File System Access handle (Chromium) to write back silently; Drive writes back to the picked file.

**Google Drive** is an optional storage target: the browser authenticates with Google (implicit token flow, no client secret), picks/creates a `.budget` file via the Google Picker, and reads/writes it with the Drive REST API using the `drive.file` scope. No data passes through any BudgetOnTarget server. The Client ID + API key in `drive/config.ts` are public by design and committed (referrer-locked); override with `NEXT_PUBLIC_GOOGLE_*`.

**Multi-device sync (MVP).** A Drive-backed tab re-checks the file's `modifiedTime` on focus: refreshes silently if there are no local edits, else shows a Refresh / Keep-mine banner. A save blocked by a newer copy opens an overwrite / load-theirs / cancel modal.

Full technical reference: [docs/architecture.md](docs/architecture.md).

## Guardrails — read before writing code

- **NEVER commit or push `.budget` or `.db` files.** They contain real financial data and are gitignored. Do not add real transaction exports as fixtures.
- **`target-engine.ts`, `debt-engine.ts`, `importer.ts`, and `categorizer.ts` do real money math with zero test coverage.** Change them carefully; adding tests alongside is the highest-value contribution.
- **Changing the `.budget` schema requires bumping `CURRENT_VERSION` in `store.ts`** and handling the old shape in `load()`, or you break every existing user's saved file. `load()` already backfills older fields — follow that pattern. (Schema is at `version: 3`: v2 added the `debts` array, v3 added `debt_id` on targets.)
- **All money is stored as integer cents.** Never introduce floating-point dollar amounts. (APR is stored as integer basis points.)
- **Adding an app route** means creating it under `src/app/app/`, adding it to `navItems` in `sidebar.tsx`, to `DRAWER_NAV`/`MORE_ROUTES` in `mobile-chrome.tsx`, and to `APP_SHELL` (bump `CACHE_VERSION`) in `public/sw.js`.
- **Do not add a backend, server, database, or network call.** The privacy guarantee is that nothing leaves the browser. Keep it that way.

## Contribution workflow

Feature branch off `main` (`feature/*`, `fix/*`, `chore/*`) → verify with lint + build → open a PR against `main`. CI must pass and a maintainer must approve; `main` is protected. Merges to `main` auto-deploy to production. Details in [CONTRIBUTING.md](CONTRIBUTING.md).
