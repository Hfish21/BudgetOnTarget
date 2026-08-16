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
    └── local-engine/       # THE APP CORE:
        ├── store.ts            # in-memory data store, CRUD, dirty tracking
        ├── target-engine.ts    # budget assessments, cumulative tracking  ← money math
        ├── importer.ts         # dedup, auto-categorize, transfers, pending ← money math
        ├── categorizer.ts      # rule matching                             ← money math
        ├── csv-parser.ts       # USAA format
        ├── csv-parser-generic.ts # any-bank via column mapping
        ├── file-io.ts          # File System Access API + IndexedDB
        └── types.ts            # the .budget JSON schema
```

Full technical reference: [docs/architecture.md](docs/architecture.md).

## Guardrails — read before writing code

- **NEVER commit or push `.budget` or `.db` files.** They contain real financial data and are gitignored. Do not add real transaction exports as fixtures.
- **`target-engine.ts`, `importer.ts`, and `categorizer.ts` do real money math with zero test coverage.** Change them carefully; adding tests alongside is the highest-value contribution.
- **Changing the `.budget` schema requires bumping `CURRENT_VERSION` in `store.ts`** and handling the old shape in `load()`, or you break every existing user's saved file. `load()` already backfills older fields — follow that pattern.
- **All money is stored as integer cents.** Never introduce floating-point dollar amounts.
- **Adding an app route** means creating it under `src/app/app/`, adding it to `navItems` in `sidebar.tsx`, and adding it to `APP_SHELL` in `public/sw.js`.
- **Do not add a backend, server, database, or network call.** The privacy guarantee is that nothing leaves the browser. Keep it that way.

## Contribution workflow

Feature branch off `main` (`feature/*`, `fix/*`, `chore/*`) → verify with lint + build → open a PR against `main`. CI must pass and a maintainer must approve; `main` is protected. Merges to `main` auto-deploy to production. Details in [CONTRIBUTING.md](CONTRIBUTING.md).
