# BudgetOnTarget Architecture

BudgetOnTarget is a personal household spending dashboard that runs **entirely in the browser**. There is no server, no database, and no account. You import bank CSVs, categorize transactions with rules, set monthly targets, and track progress — all client-side. Your data lives in a `.budget` JSON file you keep on your own disk.

Live at **budgetontarget.com**, served as a static site from GitHub Pages.

> **History note.** Through May 2026 this was a full-stack app: a FastAPI + SQLAlchemy + SQLite backend with a Next.js frontend talking to it over HTTP. Commit `6249e7d` (2026-05-28) ported the entire backend to TypeScript so the app could run offline as a PWA, and every feature since was built browser-only. The Python backend was removed in the PWA-only cleanup; it remains in git history at `c955a82` if it is ever needed.

---

## 1. Project Structure

```
BudgetOnTarget/
├── CLAUDE.md
├── README.md
├── LICENSE
├── docs/
│   └── architecture.md
├── .github/workflows/
│   └── deploy-pages.yml         # build → GitHub Pages on push to main
└── frontend/
    ├── next.config.ts           # output: "export" — static site, no Node server
    ├── package.json
    ├── public/                  # manifest.webmanifest, sw.js, icons, logo.svg
    └── src/
        ├── app/                 # Next.js App Router pages
        ├── components/          # React components
        ├── hooks/
        ├── lib/
        │   ├── api.ts           # the single API seam
        │   ├── utils.ts         # formatting, chart colors, status helpers
        │   └── local-engine/    # the entire application core
        └── types/               # response-shape types shared across components
```

---

## 2. The Local Engine

`src/lib/local-engine/` is the whole application core. Everything the old backend did happens here, in the browser.

| Module | Responsibility |
|---|---|
| `store.ts` | In-memory data store. Plain arrays per entity, integer IDs, dirty tracking, subscriber notifications. |
| `types.ts` | TypeScript interfaces for the `.budget` file schema. |
| `target-engine.ts` | Budget assessments, cumulative daily series, lane and target history. The domain core. |
| `categorizer.ts` | Rule matching (substring / regex), bulk recategorization. |
| `csv-parser.ts` | USAA CSV format, with sign normalization. |
| `csv-parser-generic.ts` | Any bank, via user-supplied column mapping. Auto-detects headers and date format. |
| `importer.ts` | Dedup by hash, auto-categorize, internal-transfer detection, pending overlay. |
| `hasher.ts` | SHA-256 via the Web Crypto API. |
| `file-io.ts` | File System Access API with a download fallback; IndexedDB auto-save. |
| `local-api.ts` | Assembles the modules above into the API surface components call. |

### The API seam

Components never import the engine directly. They import `api` from `@/lib/api`, which resolves to `localApi`:

```ts
import { api } from "@/lib/api";

const dashboard = await api.dashboard.getAssessments(year, month);
```

Every method is `async` even though nothing crosses a network. That is deliberate: it keeps the call sites identical to what a hosted backend would need, so reintroducing one is a change to `api.ts` alone.

---

## 3. Data Model

All seven entities live in a single `.budget` JSON file (schema `version: 1`), with integer IDs for internal references.

### Design decision: cents, not dollars

Every monetary value is an integer number of cents. $25.49 is stored as `2549`. This eliminates floating-point comparison and rounding bugs. The CSV parser converts dollar strings to cents at import time; the UI formats back to dollars for display only.

### Sign convention

Normalized at parse time, before anything else sees a transaction: **negative = money out, positive = money in**. Credit-card CSVs (where a charge is positive) are inverted by the parser so the rest of the app never has to know which account type a row came from.

### Entities

| Entity | Notes |
|---|---|
| `accounts` | `checking` / `credit` / `savings`; `joint` or `personal` (personal accounts attribute every transaction to one member). |
| `household_members` | Who a transaction belongs to, for person-scoped targets. |
| `categories` | Flat or one level deep via `parent_category_id`. |
| `category_rules` | Pattern + match type + category + priority. |
| `targets` | The budget goals. See below. |
| `transactions` | The ledger. Carries `is_internal_transfer`, `is_excluded`, `is_pending`, `is_manually_categorized`. |
| `csv_imports` | One row per imported file. Deleting one deletes its transactions. |
| `tags` | Reserved; not yet surfaced in the UI. |

---

## 4. Targets and Assessment

A **target** is a filter plus a goal. The filter narrows the month's transactions; the goal judges the result.

**Filter** — any combination of:
- `category_id` — a single category
- `description_pattern` — case-insensitive substring on the description
- `person_scope` — a household member, matched by name
- `spend_group` — which lane the target belongs to

Transactions marked `is_internal_transfer` or `is_excluded` never count toward any target.

**Goal** — a `direction`, a `value`, and two tolerance bands:

| Direction | Meaning | Sums |
|---|---|---|
| `at_most` | A spending cap | Absolute value of negative amounts |
| `at_least` | An income floor | Positive amounts |
| `exactly` | A fixed expectation | Absolute value of the net |

**Status** — `on_target`, `in_tolerance`, or `off_target`, from `value` and the asymmetric `tolerance_upper` / `tolerance_lower` bands. A `count`-type target counts matching transactions instead of summing them.

### Spend groups (lanes)

Four lanes organize targets on the dashboard: `income`, `necessary`, `discretionary`, `anomalous`.

One subtlety worth knowing: a `discretionary` or `anomalous` target with **no** `category_id` acts as a catch-all. It sweeps up everything not already claimed by an active `necessary` or `income` target, so uncategorized spending still lands somewhere visible instead of disappearing.

### Computed on the fly

No materialized rollups, no cache. A month is under a thousand transactions against a couple dozen targets — recomputing is well under 50ms, and there is no invalidation logic to get wrong.

---

## 5. Import Pipeline

```
CSV file
  → parser (USAA or generic mapping)   sign normalization, date parsing
  → SHA-256 hash per row               date + amount + raw_description + account_id
  → dedup against existing hashes
  → auto-categorize via rules
  → internal-transfer detection
  → store
```

**File-level dedup.** Each import records the file's SHA-256. Re-importing the same file is a no-op that reports `DUPLICATE_FILE` — unless you are opting into pending rows this time, in which case the file is reprocessed so its pending rows can be reconciled (the posted rows all dedup away harmlessly).

**Pending is a volatile overlay.** Every import for an account first deletes that account's existing pending rows, then re-inserts the current ones. A pending charge that later posts — with a changed amount, date, or description, so a different hash — is therefore never double-counted.

**Category rule priority.** Rules evaluate in ascending priority order; lower number wins. New rules default to `MAX(existing) + 10`, so there is room to insert between rules without renumbering.

---

## 6. Storage and Persistence

Two layers, both entirely local:

1. **IndexedDB auto-save** — `storage-provider.tsx` subscribes to the store and writes a serialized snapshot 2 seconds after the last change. This is what survives a page refresh.
2. **`.budget` file** — an explicit save through the File System Access API (Chromium) or a download fallback. This is the durable copy the user owns and backs up.

`StorageProvider` also exposes a `dataVersion` counter that increments on every store mutation. Components depend on it to re-fetch, since the store is mutable and outside React's rendering model.

---

## 7. Frontend

**Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind CSS 4, shadcn/ui on Base UI, Recharts, lucide-react.

**Pages:**

| Route | Purpose |
|---|---|
| `/dashboard` | Monthly overview — net summary, cumulative chart, target cards grouped by lane |
| `/trends` | Multi-month history — spending, net cash flow, lane scorecards, delta breakdown |
| `/transactions` | Browse, filter, categorize, exclude |
| `/import` | CSV upload and import history |
| `/targets` | Create and edit targets |
| `/settings` | Accounts, members, categories, rules, data portability |

**First run** is handled by a setup wizard (`components/wizard/`): CSV upload → field mapping → category review → target suggestions → done.

**State** is URL params (selected month) plus React state. No global state manager — the app is five pages of client-side data and does not need one.

**Privacy mode** (`privacy-provider.tsx`) blurs every monetary value in the UI, including chart axis ticks, for screen-sharing.

---

## 8. Build and Deploy

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static export → frontend/out/
pnpm preview    # serve the built output locally
pnpm lint
```

`.github/workflows/deploy-pages.yml` builds and publishes `frontend/out/` to GitHub Pages on every push to `main`. The custom domain serves from root, so no `basePath` is configured.

The PWA service worker (`public/sw.js`) uses stale-while-revalidate, making the app fully usable offline once loaded.

---

## 9. Technical Decisions Log

| Decision | Chosen | Alternatives | Rationale |
|---|---|---|---|
| Monetary storage | Integer cents | Float, Decimal | No floating-point bugs. Simpler comparisons. |
| Where logic runs | Browser | Hosted API | No server, no accounts, no financial data leaving the device. Also makes the app free to host and usable offline. |
| Data storage | User-held `.budget` file | Hosted DB, localStorage only | The user owns and can back up their data. No custodianship of anyone's finances. |
| Target assessment | Computed on the fly | Materialized table | Tiny dataset, sub-50ms compute, zero invalidation complexity. |
| API shape | Async seam over a sync engine | Direct engine imports | Keeps call sites backend-shaped, so a hosted mode is a one-file change. |
| Frontend state | URL params + React state | Zustand, Redux, TanStack Query | Five pages, client-side data. A state manager is overhead for nothing. |
| Bank parsers | One explicit parser + one generic mapper | Fully generic parser | Bank CSVs are too inconsistent to guess. The mapper covers the rest with user input. |
| Person scope on targets | Member name string | FK to household member | `"Hayden"` reads better than `member_id=1` in a target definition. Resolved at query time. |
| Auth | None | Any | There is no server to authenticate against. |

---

## 10. Known Gaps

- **No test suite.** The engine's money math — `target-engine.ts`, `importer.ts`, `categorizer.ts` — has no automated coverage. The deleted Python suite (`backend/tests/`, recoverable at `c955a82`) is a usable spec for a TypeScript port.
- **Internal-transfer patterns are hardcoded.** `importer.ts` matches USAA-specific strings and two literal household member names. This ships to every visitor and should be user-configurable.
- **Tags** exist in the schema but have no UI.
- **Desktop-first.** The layout assumes a fixed 240px sidebar and does not collapse on small screens.
