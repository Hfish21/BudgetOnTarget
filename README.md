<p align="center">
  <img src="frontend/public/logo.svg" alt="BudgetOnTarget" width="80" height="80">
</p>

<h1 align="center">BudgetOnTarget</h1>

<p align="center">
  A self-hosted personal budget dashboard that turns bank CSV exports into actionable spending insights.
  <br />
  Set targets, track trends, and understand where your money goes — without handing your data to a third party.
</p>

<p align="center">
  <a href="#quick-start-docker">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#manual-setup">Manual Setup</a> &bull;
  <a href="#csv-import-guide">CSV Import</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#contributing">Contributing</a>
</p>

---

## Why BudgetOnTarget?

Most budgeting tools either cost money, require linking your bank account, or lock your data in someone else's cloud. BudgetOnTarget is different:

- **Your data stays on your machine.** Everything runs locally with SQLite — no cloud, no accounts, no subscriptions.
- **Bank-agnostic.** Import CSV exports from any bank (ships with USAA parser, easy to add others).
- **Target-based budgeting.** Set spending/income targets per category with tolerance bands, then track performance month over month.
- **Privacy mode.** One-click blur on all financial figures so you can demo or screenshot without revealing numbers.

## Features

### Monthly Dashboard
At-a-glance view of your budget health for any month. Income, necessary, discretionary, and anomalous spending are grouped into lanes with cumulative progress charts and per-target drill-downs.

<!-- Add your own screenshot: toggle Privacy Mode on, take a screenshot, save to docs/screenshots/dashboard.png -->

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

## Quick Start (Docker)

```bash
git clone https://github.com/Hfish21/BudgetOnTarget.git
cd BudgetOnTarget
docker compose up --build
```

That's it. Open [http://localhost:3000](http://localhost:3000).

The first run will:
1. Build both containers (Python backend + Next.js frontend)
2. Run database migrations to create the schema
3. Seed default categories, category rules, and a starter Grocery Budget target

**Next steps:** Head to **Import** to upload your first bank CSV, then visit **Targets** to configure your budget.

## Manual Setup

### Prerequisites
- **Python 3.12+** with [uv](https://docs.astral.sh/uv/)
- **Node.js 22+** with [pnpm](https://pnpm.io/)

### Backend

```bash
cd backend
cp .env.example .env        # Uses SQLite by default — no database server needed
uv sync                     # Install Python dependencies
uv run alembic upgrade head  # Create database schema
uv run python -m app.seed.run  # Seed categories, rules, and starter target
uv run uvicorn app.main:app --reload --port 8000
```

API docs are auto-generated at [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## CSV Import Guide

BudgetOnTarget ships with a parser for **USAA** bank CSV exports. The expected format is:

```
Date,Description,Original Description,Category,Amount,Status
```

### Supported Account Types

| Type | Sign Convention | Example |
|------|----------------|---------|
| **Checking / Savings** | Negative = money out, Positive = money in | Already normalized |
| **Credit Card** | USAA exports charges as positive — BudgetOnTarget flips the sign automatically | A $50 charge imports as -$50 |

### How to Import

1. Download CSV exports from your bank's website
2. Go to **Import** in BudgetOnTarget
3. Select the account (set up accounts in **Settings** first)
4. Upload the CSV file

BudgetOnTarget deduplicates automatically — re-importing the same file or overlapping date ranges won't create duplicate transactions. Pending transactions are skipped.

### Adding Support for Other Banks

Create a new parser class in `backend/app/services/` following the pattern in `csv_parser.py`. The parser needs to produce `ParsedTransaction` objects with normalized sign conventions (negative = out, positive = in).

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│   Next.js Frontend  │────▶│   FastAPI Backend     │
│   Port 3000         │ API │   Port 8000           │
│                     │     │                       │
│  - Dashboard        │     │  - Target Engine      │
│  - Trends           │     │  - CSV Parser/Import  │
│  - Transactions     │     │  - Auto-Categorizer   │
│  - Import           │     │  - Assessment Engine   │
│  - Targets          │     │                       │
└─────────────────────┘     └───────┬───────────────┘
                                    │
                              ┌─────┴─────┐
                              │  SQLite    │
                              │  (local)   │
                              └────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic 2.0, Alembic |
| **Database** | SQLite with WAL mode |
| **Package Managers** | uv (Python), pnpm (Node) |
| **Containerization** | Docker Compose |

### Project Structure

```
BudgetOnTarget/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routes/          # API endpoints
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic (parser, categorizer, target engine)
│   │   └── seed/            # Default data seeder
│   ├── alembic/             # Database migrations
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript type definitions
│   ├── public/              # Static assets (logo, etc.)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

### Key Concepts

- **Transactions** are imported from CSV with a normalized sign convention: negative = money out, positive = money in.
- **Categories** group transactions (Groceries, Dining Out, Gas, etc.). Auto-assigned by category rules or manually via the UI.
- **Targets** define budget goals tied to a category, with a direction (`at_most` for spending caps, `at_least` for income floors), tolerance bands, and optional person/description filters.
- **Spend Groups** organize targets into four lanes: `income`, `necessary`, `discretionary`, and `anomalous`.
- **Assessments** are computed on the fly — no materialized rollups. The target engine queries transactions for a given month and evaluates each target as `on_target`, `in_tolerance`, or `off_target`.
- **Internal transfers** (credit card payments, Zelle between household members) are auto-detected and excluded from budget calculations.

## Configuration

Environment variables (set in `.env` or `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_DATABASE_URL` | `sqlite:///./budgetontarget.db` | SQLAlchemy database URL |
| `BOT_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |
| `BOT_LOG_LEVEL` | `INFO` | Logging level |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Backend API URL (frontend) |

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run the tests: `cd backend && uv run pytest`
5. Submit a pull request

### Areas for Contribution

- **Bank parsers** — Add CSV parsers for Chase, Bank of America, Wells Fargo, etc.
- **Plaid integration** — Automatic transaction syncing via Plaid API
- **Data visualization** — New chart types, spending breakdowns, year-over-year comparisons
- **Multi-user support** — Authentication and household sharing
- **Mobile responsiveness** — The UI is currently desktop-optimized

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
