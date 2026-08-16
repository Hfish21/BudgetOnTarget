<p align="center">
  <img src="frontend/public/logo.svg" alt="BudgetOnTarget" width="80" height="80">
</p>

<h1 align="center">BudgetOnTarget</h1>

<p align="center">
  A personal budget dashboard that turns bank CSV exports into actionable spending insights.
  <br />
  Set targets, track trends, and understand where your money goes — entirely in your browser.
</p>

<p align="center">
  <a href="https://budgetontarget.com"><strong>budgetontarget.com</strong></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#csv-import-guide">CSV Import</a> &bull;
  <a href="#running-locally">Running Locally</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## Why BudgetOnTarget?

Most budgeting tools either cost money, require linking your bank account, or lock your data in someone else's cloud. BudgetOnTarget is different:

- **Your data never leaves your device.** There is no server and no database. Everything runs in your browser, and your data lives in a `.budget` file you save to your own disk.
- **No account, no signup, no subscription.** Open the site and start.
- **Bank-agnostic.** Ships with a USAA parser plus a generic column mapper for any other bank's CSV.
- **Target-based budgeting.** Set spending and income targets per category with tolerance bands, then track performance month over month.
- **Works offline.** It's a PWA — once loaded, it runs with no network at all.

## Quick Start

Go to **[budgetontarget.com](https://budgetontarget.com)**. The setup wizard walks you through uploading your first CSV, mapping its columns, reviewing categories, and setting starter targets.

When you're done, click **Save** in the sidebar to write a `.budget` file to your disk. That file is your data — back it up like any other document. Your work is also auto-saved to browser storage every couple of seconds, so a refresh won't lose anything.

> **Privacy:** nothing is uploaded anywhere. The site is static files; there is no backend to send data to.

## Features

### Monthly Dashboard
At-a-glance view of your budget health for any month. Income, necessary, discretionary, and anomalous spending are grouped into lanes with cumulative progress charts and per-target drill-downs.

### Trends
Multi-month view (3/6/12 months) with grouped bar charts comparing income vs. spending by lane, net cash flow tracking, and per-lane scorecards showing averages and deltas.

### Transaction Browser
Searchable, filterable transaction table with inline re-categorization. Filter by date range, category, lane, household member, or uncategorized-only. Daily subtotals show at-a-glance spending per day.

### Target Configuration
Define spending and income targets tied to categories. Each target has a direction (at most / at least / exactly), tolerance bands, and optional person or description-pattern scoping.

### Privacy Mode
Toggle in the sidebar blurs all financial values across every page — charts, cards, tables, tooltips — so you can share your screen or take screenshots without exposing numbers.

### Auto-Categorization
Rule-based engine matches transaction descriptions to categories using substring or regex patterns. Ships with 30+ default rules for common merchants. Add your own through the UI.

## CSV Import Guide

BudgetOnTarget reads **USAA** exports natively:

```
Date,Description,Original Description,Category,Amount,Status
```

For any other bank, the importer auto-detects the columns and date format and lets you correct the mapping before importing.

### Supported Account Types

| Type | Sign Convention | Example |
|------|----------------|---------|
| **Checking / Savings** | Negative = money out, Positive = money in | Already normalized |
| **Credit Card** | Banks export charges as positive — BudgetOnTarget flips the sign automatically | A $50 charge imports as -$50 |

### How to Import

1. Download CSV exports from your bank's website
2. Set up your accounts in **Settings**
3. Go to **Import**, select the account, and upload the file

Deduplication is automatic — re-importing the same file or an overlapping date range won't create duplicates. Pending transactions are opt-in, and are reconciled on every subsequent import so a charge that later posts is never counted twice.

## Running Locally

The whole app is a static Next.js frontend. **There is no backend, no database, and nothing to configure** — you clone it and run one dev server. Setup takes about two minutes.

### Prerequisites

You need exactly two things: **Node.js 22** and **pnpm**. The repo pins both versions for you, so you don't have to guess.

**1. Install Node.js 22.** If you use [nvm](https://github.com/nvm-sh/nvm) (recommended) or [fnm](https://github.com/Schniz/fnm), the repo's `.nvmrc` picks the right version automatically — see step 2 below. Otherwise, download Node 22 LTS from [nodejs.org](https://nodejs.org).

**2. You do _not_ need to install pnpm separately.** pnpm ships with Node via [Corepack](https://nodejs.org/api/corepack.html). One command turns it on and locks it to the exact version this repo expects:

```bash
corepack enable
```

That's the single step most people miss — it's why `pnpm: command not found` happens.

### Setup

```bash
# 1. Clone
git clone https://github.com/Hfish21/BudgetOnTarget.git
cd BudgetOnTarget

# 2. Use the pinned Node version (skip if not using nvm/fnm)
nvm use                 # or: fnm use  — reads .nvmrc, installs 22 if needed

# 3. Enable pnpm (once per machine)
corepack enable

# 4. Install dependencies and start the dev server
cd frontend
pnpm install
pnpm dev
```

Open **[http://localhost:3000](http://localhost:3000)**. That's it — you're running the full app with hot reload. There is nothing else to start.

> **Note:** The repo may contain a leftover `backend/` folder from an earlier full-stack version. **Ignore it** — it is not used, not tracked in git, and nothing in it needs to run. The entire app lives in `frontend/`.

### Other commands

Run these from `frontend/`:

```bash
pnpm build      # static export → frontend/out/ (also the strictest type check)
pnpm preview    # serve the built output locally
pnpm lint       # ESLint
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm: command not found` | Run `corepack enable` (see Prerequisites). It ships with Node — no separate install needed. |
| `Unsupported engine` / wrong Node version | You're not on Node 22. Run `nvm use` (or install Node 22 from [nodejs.org](https://nodejs.org)). |
| `corepack: command not found` | Your Node is too old or Corepack is disabled. Install Node 22 LTS from [nodejs.org](https://nodejs.org), then retry. |
| Port 3000 already in use | Stop the other process, or run `pnpm dev -- -p 3001` and open port 3001. |
| Lockfile / install errors | Delete `frontend/node_modules` and run `pnpm install` again. |

## Architecture

```
┌─────────────────────────────────────────┐
│          Browser (no server)            │
│                                         │
│   Next.js UI                            │
│        │                                │
│        ▼                                │
│   src/lib/api.ts  ── the API seam       │
│        │                                │
│        ▼                                │
│   local-engine/                         │
│     ├── csv-parser / importer           │
│     ├── categorizer                     │
│     ├── target-engine                   │
│     └── store  (in-memory)              │
│        │                                │
│        ├──▶ IndexedDB   (auto-save)     │
│        └──▶ .budget file (you own it)   │
└─────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, static export), React 19, TypeScript |
| **Styling** | Tailwind CSS 4, shadcn/ui on Base UI |
| **Charts** | Recharts |
| **Storage** | File System Access API + IndexedDB |
| **Hosting** | GitHub Pages (static) |

### Key Concepts

- **Transactions** are imported from CSV with a normalized sign convention: negative = money out, positive = money in. All amounts are stored as integer cents.
- **Categories** group transactions (Groceries, Dining Out, Gas, etc.). Auto-assigned by category rules or set manually.
- **Targets** define budget goals tied to a category, with a direction (`at_most` for spending caps, `at_least` for income floors), tolerance bands, and optional person or description filters.
- **Spend Groups** organize targets into four lanes: `income`, `necessary`, `discretionary`, and `anomalous`.
- **Assessments** are computed on the fly — no stored rollups. The target engine evaluates each target for a given month as `on_target`, `in_tolerance`, or `off_target`.
- **Internal transfers** (credit card payments, transfers between household members) are auto-detected and excluded from budget calculations.

See [`docs/architecture.md`](docs/architecture.md) for the full technical reference.

## Contributing

Contributions are welcome. The short version:

1. **Fork** the repository and clone your fork
2. Follow [Running Locally](#running-locally) to get set up
3. Create a feature branch (`git checkout -b feature/my-feature`)
4. Make your changes and verify with `cd frontend && pnpm lint && pnpm build`
5. Push to your fork and open a **pull request** against `main`

CI (lint + build) runs automatically on every PR, and `main` is protected — a maintainer reviews and approves before anything merges. Full details, project layout, and conventions are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.

### Areas for Contribution

- **Test coverage** — the engine's money math currently has none. This is the highest-value contribution.
- **Configurable internal-transfer detection** — the patterns are hardcoded in `importer.ts` and should be user-editable.
- **Bank parsers** — dedicated parsers for Chase, Bank of America, Wells Fargo, etc.
- **Data visualization** — new chart types, spending breakdowns, year-over-year comparisons.
- **Mobile responsiveness** — the UI is currently desktop-optimized.

## License

MIT — see [LICENSE](LICENSE).
