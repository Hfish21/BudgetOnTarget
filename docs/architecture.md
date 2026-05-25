# BudgetOnTarget Architecture

Technical blueprint for the BudgetOnTarget personal household spending dashboard. This document contains everything an Engineer agent needs to build the MVP with zero ambiguity.

---

## 1. Project Structure

```
budgetontarget/
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── backend/
│   ├── pyproject.toml              # uv-managed Python deps
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI entrypoint
│   │   ├── config.py               # Pydantic BaseSettings
│   │   ├── database.py             # SQLAlchemy engine + session
│   │   ├── models/
│   │   │   ├── __init__.py         # Re-exports all models
│   │   │   ├── household_member.py
│   │   │   ├── account.py
│   │   │   ├── transaction.py
│   │   │   ├── category.py
│   │   │   ├── category_rule.py
│   │   │   ├── target.py
│   │   │   └── csv_import.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── household_member.py
│   │   │   ├── account.py
│   │   │   ├── transaction.py
│   │   │   ├── category.py
│   │   │   ├── category_rule.py
│   │   │   ├── target.py
│   │   │   └── csv_import.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── transactions.py
│   │   │   ├── categories.py
│   │   │   ├── category_rules.py
│   │   │   ├── targets.py
│   │   │   ├── imports.py
│   │   │   ├── household_members.py
│   │   │   ├── accounts.py
│   │   │   └── dashboard.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── csv_parser.py       # CSV parsing + normalization
│   │   │   ├── importer.py         # Orchestrates import flow
│   │   │   ├── categorizer.py      # Rule evaluation engine
│   │   │   ├── target_engine.py    # Target assessment computation
│   │   │   └── hasher.py           # Transaction dedup hashing
│   │   └── seed/
│   │       ├── __init__.py
│   │       ├── categories.py       # Default category list
│   │       └── rules.py            # Starter category rules (~50)
│   └── tests/
│       ├── conftest.py
│       ├── test_csv_parser.py
│       ├── test_categorizer.py
│       ├── test_target_engine.py
│       └── test_importer.py
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── components.json            # shadcn/ui config
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          # Root layout (nav sidebar)
│       │   ├── page.tsx            # Redirects to /dashboard
│       │   ├── dashboard/
│       │   │   └── page.tsx        # Target cards grid
│       │   ├── transactions/
│       │   │   └── page.tsx        # Transaction list
│       │   ├── targets/
│       │   │   ├── page.tsx        # Target management CRUD
│       │   │   └── [id]/
│       │   │       └── page.tsx    # Single target detail + chart
│       │   ├── import/
│       │   │   └── page.tsx        # CSV upload
│       │   └── settings/
│       │       └── page.tsx        # Categories, rules, members, accounts
│       ├── components/
│       │   ├── ui/                 # shadcn/ui components (generated)
│       │   ├── layout/
│       │   │   ├── sidebar.tsx
│       │   │   └── header.tsx
│       │   ├── dashboard/
│       │   │   ├── target-card.tsx
│       │   │   ├── target-grid.tsx
│       │   │   └── month-selector.tsx
│       │   ├── charts/
│       │   │   └── cumulative-progress-chart.tsx
│       │   ├── transactions/
│       │   │   ├── transaction-table.tsx
│       │   │   ├── transaction-filters.tsx
│       │   │   └── categorize-dialog.tsx
│       │   ├── import/
│       │   │   ├── csv-upload.tsx
│       │   │   └── import-results.tsx
│       │   ├── targets/
│       │   │   ├── target-form.tsx
│       │   │   └── target-history-grid.tsx
│       │   └── settings/
│       │       ├── category-list.tsx
│       │       ├── rule-list.tsx
│       │       ├── member-form.tsx
│       │       └── account-form.tsx
│       ├── lib/
│       │   ├── api.ts              # Fetch wrapper, base URL config
│       │   └── utils.ts            # Formatting, date helpers
│       └── types/
│           └── index.ts            # TypeScript types mirroring Pydantic schemas
└── docs/
    └── architecture.md             # This file
```

---

## 2. Database Schema (SQLAlchemy Models)

All models use SQLAlchemy 2.0 declarative style with mapped_column. SQLite is the database engine. All timestamps are UTC. All monetary amounts are stored as integers (cents) to avoid floating-point issues.

### Design Decision: Cents, Not Dollars

Store all monetary values as integers representing cents. $25.49 is stored as 2549. This eliminates all floating-point comparison and rounding issues. The frontend formats cents to dollars for display. The CSV parser converts dollar strings to cents at import time.

### 2.1 household_members

```python
class HouseholdMember(Base):
    __tablename__ = "household_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    card_identifiers: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # JSON-serialized list of strings, e.g. '["1234", "5678"]'
    # Using Text + json.loads/dumps because SQLite has no native JSON column type
    # in SQLAlchemy's portable dialect.

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="household_member")
```

### 2.2 accounts

```python
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # One of: "checking", "credit", "savings"

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")
```

### 2.3 categories

```python
class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    parent_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    parent: Mapped["Category | None"] = relationship(
        remote_side=[id], back_populates="children"
    )
    children: Mapped[list["Category"]] = relationship(back_populates="parent")
    rules: Mapped[list["CategoryRule"]] = relationship(back_populates="category")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
    targets: Mapped[list["Target"]] = relationship(back_populates="category")
```

### 2.4 category_rules

```python
class CategoryRule(Base):
    __tablename__ = "category_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    pattern: Mapped[str] = mapped_column(String(500), nullable=False)
    match_type: Mapped[str] = mapped_column(String(20), nullable=False, default="substring")
    # One of: "substring", "regex"
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Lower number = higher priority. Evaluated ascending.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    category: Mapped["Category"] = relationship(back_populates="rules")

    __table_args__ = (
        Index("ix_category_rules_priority", "priority"),
    )
```

### 2.5 transactions

```python
class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # SHA-256 of (date + amount_cents + raw_description + account_id)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    # Cleaned/normalized description for display and rule matching
    raw_description: Mapped[str] = mapped_column(String(500), nullable=False)
    # Original description from CSV, preserved verbatim
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # Positive = money in (income, refunds). Negative = money out (spending).
    # Normalized at import time regardless of bank's convention.

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    household_member_id: Mapped[int | None] = mapped_column(
        ForeignKey("household_members.id"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    is_manually_categorized: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    csv_import_id: Mapped[int | None] = mapped_column(
        ForeignKey("csv_imports.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    account: Mapped["Account"] = relationship(back_populates="transactions")
    household_member: Mapped["HouseholdMember | None"] = relationship(
        back_populates="transactions"
    )
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    csv_import: Mapped["CsvImport | None"] = relationship(back_populates="transactions")

    __table_args__ = (
        Index("ix_transactions_date", "date"),
        Index("ix_transactions_category_id", "category_id"),
        Index("ix_transactions_household_member_id", "household_member_id"),
        Index("ix_transactions_date_category", "date", "category_id"),
    )
```

### 2.6 targets

```python
class Target(Base):
    __tablename__ = "targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # One of: "monetary", "count"
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    # One of: "at_most", "at_least", "exactly"
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    # For monetary: value in cents. For count: the count as-is.
    tolerance_upper: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tolerance_lower: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Same unit as value (cents for monetary, count for count).
    period: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    # MVP: "monthly" only. Column exists for future expansion.
    person_scope: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # NULL = household (all members). Otherwise, the household_member name.
    # Storing name not ID to keep target definitions human-readable.
    # Match against household_members.name at query time.
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    description_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional substring match on transaction description. For targets like
    # "Rural King at most 3 times/month" that need pattern-based filtering.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    category: Mapped["Category | None"] = relationship(back_populates="targets")
```

### 2.7 csv_imports

```python
class CsvImport(Base):
    __tablename__ = "csv_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # SHA-256 of the entire file content. Used for whole-file dedup.
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    new_transaction_count: Mapped[int] = mapped_column(Integer, nullable=False)
    # How many rows were actually new (not duplicates). Useful for user feedback.
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="csv_import")
```

---

## 3. Service Layer Architecture

### 3.1 CSV Parser (`services/csv_parser.py`)

Responsible for reading a CSV file and producing a list of normalized row dicts. Does NOT touch the database.

```python
@dataclass
class ParsedTransaction:
    date: date
    raw_description: str
    description: str          # Cleaned: stripped, uppercased, extra whitespace collapsed
    amount_cents: int         # Positive = income, negative = expense
    card_last_four: str | None  # Extracted from CSV if available

class CsvParser:
    """Base class. One subclass per bank schema."""

    def parse(self, file_content: bytes, filename: str) -> list[ParsedTransaction]:
        raise NotImplementedError

class ChaseParser(CsvParser):
    """
    Chase CSV format:
    Transaction Date, Post Date, Description, Category, Type, Amount, Memo
    Amount is negative for charges, positive for payments/credits.
    """
    def parse(self, file_content: bytes, filename: str) -> list[ParsedTransaction]:
        ...
```

**Parser selection strategy for MVP:** The import endpoint accepts an `account_id` parameter. The account's institution field determines which parser to use. Start with one parser (whatever bank Hayden uses). Adding a second bank is: write a new parser subclass, register it in a `PARSERS: dict[str, type[CsvParser]]` mapping.

**Description cleaning logic:**
1. Strip leading/trailing whitespace
2. Collapse multiple spaces to single space
3. Uppercase for consistent rule matching
4. Store original as `raw_description`, cleaned as `description`

### 3.2 Hasher (`services/hasher.py`)

```python
import hashlib

def compute_transaction_hash(
    date: date,
    amount_cents: int,
    raw_description: str,
    account_id: int,
) -> str:
    """
    SHA-256 hash for deduplication. Uses raw_description (not cleaned)
    to ensure exact-match semantics. Uses account_id to allow the same
    transaction description+amount on the same date in different accounts.
    """
    payload = f"{date.isoformat()}|{amount_cents}|{raw_description}|{account_id}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

**Known edge case:** Two genuinely different transactions with the same date, amount, description, and account will collide. This is rare in practice (two $5.00 charges at the same Starbucks on the same day). Accepted trade-off for MVP. If it becomes a problem, add a sequence counter to the hash.

### 3.3 Importer (`services/importer.py`)

Orchestrates the full import pipeline. This is the core business logic for CSV ingestion.

```python
@dataclass
class ImportResult:
    csv_import_id: int
    total_rows: int
    new_transactions: int
    duplicate_transactions: int
    categorized_count: int
    uncategorized_count: int
    errors: list[str]

class ImportService:
    def __init__(self, db: Session, parser: CsvParser, categorizer: Categorizer):
        ...

    def import_csv(
        self,
        file_content: bytes,
        filename: str,
        account_id: int,
    ) -> ImportResult:
        """
        Full import flow:
        1. Compute file hash. If csv_imports already has this hash, return early
           with a "duplicate file" result (no error, just a no-op).
        2. Parse CSV into ParsedTransaction list.
        3. For each parsed transaction:
           a. Compute external_hash
           b. Check if hash exists in transactions table — skip if yes
           c. Assign household_member_id by matching card_last_four
              against household_members.card_identifiers
           d. Run through categorizer to get category_id
           e. Create Transaction ORM object
        4. Bulk insert all new transactions.
        5. Create csv_imports record with counts.
        6. Commit.
        7. Return ImportResult.
        """
```

**Person assignment logic:** The parser extracts `card_last_four` from the CSV (if the bank includes it). The importer iterates `household_members`, deserializes each member's `card_identifiers` JSON, and checks if `card_last_four` is in the list. First match wins. If no match or no card number in CSV, `household_member_id` is NULL.

### 3.4 Categorizer (`services/categorizer.py`)

```python
class Categorizer:
    def __init__(self, db: Session):
        self._rules: list[CategoryRule] = []
        self._load_rules(db)

    def _load_rules(self, db: Session) -> None:
        """Load all active rules ordered by priority ascending."""
        self._rules = (
            db.query(CategoryRule)
            .filter(CategoryRule.is_active == True)
            .order_by(CategoryRule.priority.asc())
            .all()
        )

    def categorize(self, description: str) -> int | None:
        """
        Run description against rules in priority order.
        Return category_id of first match, or None.

        - substring: case-insensitive `pattern in description`
        - regex: re.search(pattern, description, re.IGNORECASE)
        """
        for rule in self._rules:
            if rule.match_type == "substring":
                if rule.pattern.upper() in description.upper():
                    return rule.category_id
            elif rule.match_type == "regex":
                if re.search(rule.pattern, description, re.IGNORECASE):
                    return rule.category_id
        return None

    def recategorize_all(self, db: Session) -> int:
        """
        Re-run all rules against all transactions where
        is_manually_categorized = False. Returns count of updated rows.
        Used after adding/editing rules.
        """
```

**Why load all rules into memory:** The rule set will be small (50-200 rules). Loading once per request and iterating in Python is simpler and fast enough. No need for database-side regex matching (which SQLite supports poorly anyway).

### 3.5 Target Engine (`services/target_engine.py`)

This is the most complex service. It computes target assessments on the fly (no materialized table for MVP).

```python
@dataclass
class TargetAssessment:
    target_id: int
    target_name: str
    period_start: date
    period_end: date
    actual_value: int          # cents for monetary, raw count for count
    target_value: int          # cents for monetary, raw count for count
    tolerance_upper: int
    tolerance_lower: int
    direction: str
    target_type: str
    status: str                # "on_target" | "in_tolerance" | "off_target"

class TargetEngine:
    def __init__(self, db: Session):
        self.db = db

    def assess_target(
        self, target: Target, period_start: date, period_end: date
    ) -> TargetAssessment:
        """
        1. Build transaction query filtered by:
           - date BETWEEN period_start AND period_end
           - category_id = target.category_id (if set)
           - description LIKE target.description_pattern (if set)
           - household_member matching target.person_scope (if set)
        2. Aggregate: SUM(amount_cents) for monetary, COUNT(*) for count
        3. Determine status using assessment logic (see below)
        4. Return TargetAssessment
        """

    def assess_all_targets(
        self, period_start: date, period_end: date
    ) -> list[TargetAssessment]:
        """Assess all active targets for the given period."""
        targets = self.db.query(Target).filter(Target.is_active == True).all()
        return [self.assess_target(t, period_start, period_end) for t in targets]

    def get_available_months(self) -> list[dict]:
        """
        Query distinct year-month combinations from transactions table.
        Returns list of {"year": 2025, "month": 3, "label": "March 2025"}.
        Used by the frontend to populate the month selector.
        """

    def get_cumulative_daily(
        self, target: Target, period_start: date, period_end: date
    ) -> list[dict]:
        """
        For the day-by-day cumulative chart. Returns:
        [
            {"date": "2025-03-01", "cumulative_value": 1523},
            {"date": "2025-03-02", "cumulative_value": 3201},
            ...
        ]
        Uses the same filtering logic as assess_target, but groups by date
        and computes a running sum.

        SQL approach (executed via SQLAlchemy):
        SELECT date, SUM(amount_cents) as daily_total
        FROM transactions
        WHERE <target filters>
        GROUP BY date
        ORDER BY date

        Then compute cumulative sum in Python (simpler than window functions
        in SQLite, and the data is at most 31 rows).
        """
```

**Assessment status logic (precise rules):**

```
For direction = "at_most":
    if actual <= value:                         -> "on_target" (green)
    elif actual <= value + tolerance_upper:      -> "in_tolerance" (yellow)
    else:                                        -> "off_target" (red)

For direction = "at_least":
    if actual >= value:                          -> "on_target" (green)
    elif actual >= value - tolerance_lower:       -> "in_tolerance" (yellow)
    else:                                        -> "off_target" (red)

For direction = "exactly":
    if value - tolerance_lower <= actual <= value + tolerance_upper:
        if actual == value:                      -> "on_target" (green)
        else:                                    -> "in_tolerance" (yellow)
    else:                                        -> "off_target" (red)
```

**Sign convention for monetary targets:** Spending targets (at_most on groceries) filter for negative `amount_cents` and compare `ABS(SUM(amount_cents))` against the target value. Income targets (at_least on income) filter for positive `amount_cents` and compare `SUM(amount_cents)` against the target value. The target `value` is always stored as a positive number. The engine handles sign normalization internally.

To make this work cleanly: targets have no sign concept. The engine uses `ABS(SUM(amount_cents))` for `at_most` targets (which are always about spending) and `SUM(amount_cents)` for `at_least` targets (which are always about income). For `exactly`, the engine uses `ABS()` since exact-match targets are typically about specific known charges (mortgage, paycheck).

**Period computation:** For MVP, only monthly periods. Given a year-month, `period_start` is the 1st, `period_end` is the last day of the month. Helper function:

```python
def get_month_bounds(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return start, end
```

---

## 4. API Contract

Base URL: `http://localhost:8000/api/v1`

All endpoints return JSON. All request bodies are JSON. Dates are ISO-8601 strings (`"2025-03-15"`). Monetary values in responses include both `amount_cents` (integer) and `amount_display` (formatted string like `"$25.49"`) for frontend convenience.

### 4.1 CSV Import

#### `POST /api/v1/imports/upload`

Upload a CSV file for processing.

**Request:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The CSV file |
| `account_id` | int | Yes | Which account this CSV belongs to |

**Response:** `200 OK`
```json
{
    "csv_import_id": 1,
    "filename": "chase_march_2025.csv",
    "total_rows": 142,
    "new_transactions": 138,
    "duplicate_transactions": 4,
    "categorized_count": 112,
    "uncategorized_count": 26,
    "errors": []
}
```

**Response:** `409 Conflict` (duplicate file)
```json
{
    "detail": "This file has already been imported.",
    "existing_import_id": 3
}
```

#### `GET /api/v1/imports`

List all past imports.

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "filename": "chase_march_2025.csv",
        "file_hash": "a1b2c3...",
        "imported_at": "2025-03-20T14:30:00Z",
        "row_count": 142,
        "new_transaction_count": 138,
        "account_id": 1,
        "account_name": "Chase Checking"
    }
]
```

### 4.2 Transactions

#### `GET /api/v1/transactions`

List transactions with filtering and pagination.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | current year | Filter by year |
| `month` | int | current month | Filter by month |
| `category_id` | int | - | Filter by category |
| `household_member_id` | int | - | Filter by person |
| `is_uncategorized` | bool | - | If true, only category_id IS NULL |
| `search` | string | - | Substring search on description |
| `sort_by` | string | `date` | One of: `date`, `amount_cents`, `description` |
| `sort_dir` | string | `desc` | One of: `asc`, `desc` |
| `limit` | int | 100 | Page size (max 500) |
| `offset` | int | 0 | Pagination offset |

**Response:** `200 OK`
```json
{
    "transactions": [
        {
            "id": 1,
            "date": "2025-03-15",
            "description": "PUBLIX SUPER MARKET #1234",
            "raw_description": "PUBLIX SUPER MARKET #1234  LAKE WALES FL",
            "amount_cents": -8523,
            "amount_display": "-$85.23",
            "account_id": 1,
            "account_name": "Chase Checking",
            "household_member_id": 1,
            "household_member_name": "Hayden",
            "category_id": 3,
            "category_name": "Groceries",
            "is_manually_categorized": false
        }
    ],
    "total_count": 342,
    "limit": 100,
    "offset": 0
}
```

#### `PATCH /api/v1/transactions/{id}/categorize`

Manually assign a category to a transaction.

**Request:**
```json
{
    "category_id": 5,
    "create_rule": false,
    "rule_pattern": null
}
```

If `create_rule` is `true`, also create a category rule:
```json
{
    "category_id": 5,
    "create_rule": true,
    "rule_pattern": "PUBLIX",
    "rule_match_type": "substring"
}
```

**Response:** `200 OK`
```json
{
    "transaction": { ... },
    "rule_created": true,
    "rule_id": 42,
    "retroactive_count": 7
}
```

When a rule is created, the service immediately runs it against all uncategorized transactions (`is_manually_categorized = false AND category_id IS NULL`) and returns the count of retroactively categorized transactions.

#### `GET /api/v1/transactions/months`

Get list of months that have transaction data.

**Response:** `200 OK`
```json
[
    {"year": 2025, "month": 3, "label": "March 2025", "transaction_count": 142},
    {"year": 2025, "month": 2, "label": "February 2025", "transaction_count": 128}
]
```

### 4.3 Categories

#### `GET /api/v1/categories`

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "name": "Groceries",
        "parent_category_id": null,
        "transaction_count": 45
    }
]
```

#### `POST /api/v1/categories`

**Request:**
```json
{
    "name": "Pet Supplies",
    "parent_category_id": null
}
```

**Response:** `201 Created`

#### `PUT /api/v1/categories/{id}`

#### `DELETE /api/v1/categories/{id}`

Returns `409 Conflict` if the category has transactions or rules referencing it. Response includes counts so the user can decide what to do.

### 4.4 Category Rules

#### `GET /api/v1/category-rules`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category_id` | int | - | Filter rules by category |

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "pattern": "PUBLIX",
        "match_type": "substring",
        "category_id": 3,
        "category_name": "Groceries",
        "priority": 10,
        "is_active": true,
        "created_at": "2025-03-01T00:00:00Z"
    }
]
```

#### `POST /api/v1/category-rules`

**Request:**
```json
{
    "pattern": "AMZN|AMAZON|AMZ",
    "match_type": "regex",
    "category_id": 7,
    "priority": 20
}
```

**Response:** `201 Created`

#### `PUT /api/v1/category-rules/{id}`

#### `DELETE /api/v1/category-rules/{id}`

#### `POST /api/v1/category-rules/test`

Test a pattern against existing transactions without saving.

**Request:**
```json
{
    "pattern": "STARBUCKS",
    "match_type": "substring"
}
```

**Response:** `200 OK`
```json
{
    "match_count": 12,
    "sample_matches": [
        {"id": 44, "description": "STARBUCKS #12345 ORLANDO FL", "date": "2025-03-10"},
        {"id": 89, "description": "STARBUCKS #98765 LAKE WALES FL", "date": "2025-03-14"}
    ]
}
```

#### `POST /api/v1/category-rules/recategorize`

Re-run all active rules against all non-manually-categorized transactions. Returns count of changes.

**Response:** `200 OK`
```json
{
    "updated_count": 23
}
```

### 4.5 Targets

#### `GET /api/v1/targets`

**Response:** `200 OK`
```json
[
    {
        "id": 1,
        "name": "Grocery Budget",
        "target_type": "monetary",
        "direction": "at_most",
        "value": 25000,
        "value_display": "$250.00",
        "tolerance_upper": 2500,
        "tolerance_lower": 0,
        "tolerance_upper_display": "$25.00",
        "tolerance_lower_display": "$0.00",
        "period": "monthly",
        "person_scope": null,
        "category_id": 3,
        "category_name": "Groceries",
        "description_pattern": null,
        "is_active": true
    }
]
```

#### `POST /api/v1/targets`

**Request:**
```json
{
    "name": "Grocery Budget",
    "target_type": "monetary",
    "direction": "at_most",
    "value": 25000,
    "tolerance_upper": 2500,
    "tolerance_lower": 0,
    "period": "monthly",
    "person_scope": null,
    "category_id": 3,
    "description_pattern": null,
    "is_active": true
}
```

**Response:** `201 Created`

#### `PUT /api/v1/targets/{id}`

#### `DELETE /api/v1/targets/{id}`

### 4.6 Dashboard

#### `GET /api/v1/dashboard/assessments`

The primary dashboard endpoint. Returns target assessments for a given month, plus the full history grid.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | current year | Assessment year |
| `month` | int | current month | Assessment month |

**Response:** `200 OK`
```json
{
    "period": {"year": 2025, "month": 3, "label": "March 2025"},
    "assessments": [
        {
            "target_id": 1,
            "target_name": "Grocery Budget",
            "target_type": "monetary",
            "direction": "at_most",
            "actual_value": 22340,
            "actual_display": "$223.40",
            "target_value": 25000,
            "target_display": "$250.00",
            "tolerance_upper": 2500,
            "tolerance_lower": 0,
            "status": "on_target",
            "percent_of_target": 89.4,
            "history": [
                {"year": 2025, "month": 1, "status": "on_target"},
                {"year": 2025, "month": 2, "status": "in_tolerance"},
                {"year": 2025, "month": 3, "status": "on_target"}
            ]
        }
    ]
}
```

The `history` array contains one entry per month that has transaction data, for ALL months in the dataset. This powers the "target grid across all months" view.

#### `GET /api/v1/dashboard/cumulative`

Day-by-day cumulative data for the progress chart.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `year` | int | required | |
| `month` | int | required | |
| `target_ids` | string | all active | Comma-separated target IDs to include |

**Response:** `200 OK`
```json
{
    "period": {"year": 2025, "month": 3},
    "targets": [
        {
            "target_id": 1,
            "target_name": "Grocery Budget",
            "target_value": 25000,
            "target_display": "$250.00",
            "direction": "at_most",
            "data_points": [
                {"date": "2025-03-01", "cumulative_value": 4523, "cumulative_display": "$45.23"},
                {"date": "2025-03-03", "cumulative_value": 9801, "cumulative_display": "$98.01"},
                {"date": "2025-03-05", "cumulative_value": 12340, "cumulative_display": "$123.40"}
            ]
        },
        {
            "target_id": 2,
            "target_name": "Dining Out",
            "target_value": 15000,
            "target_display": "$150.00",
            "direction": "at_most",
            "data_points": [
                {"date": "2025-03-02", "cumulative_value": 2100, "cumulative_display": "$21.00"}
            ]
        }
    ]
}
```

Note: `data_points` only includes dates where a matching transaction occurred. The frontend fills in gaps (flat line on days with no spending) when rendering the chart.

### 4.7 Household Members

#### `GET /api/v1/household-members`
#### `POST /api/v1/household-members`
#### `PUT /api/v1/household-members/{id}`

Standard CRUD. Request/response shape mirrors the model.

### 4.8 Accounts

#### `GET /api/v1/accounts`
#### `POST /api/v1/accounts`
#### `PUT /api/v1/accounts/{id}`

Standard CRUD. Request/response shape mirrors the model.

### 4.9 Health

#### `GET /health`

**Response:** `200 OK`
```json
{"status": "ok", "version": "0.1.0"}
```

---

## 5. Frontend Architecture

### 5.1 Tech Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Next.js 15 (App Router) | SSAC standard. Pages + layouts. |
| Language | TypeScript (strict) | SSAC standard. |
| Styling | Tailwind CSS | SSAC standard. |
| Components | shadcn/ui | Pre-built, accessible, customizable. |
| Charts | Recharts | React-native, composable, good docs. |
| Data fetching | Server components + client fetch | Server components for initial load, client fetch for interactive filters. |
| State management | React state + URL search params | No Redux, no Zustand. App state is small. URL params for filter state (shareable, back-button friendly). |
| API client | Thin fetch wrapper | No axios, no tanstack-query for MVP. A `lib/api.ts` with typed fetch functions is enough. |

### 5.2 Page Structure

```
/                          -> Redirect to /dashboard
/dashboard                 -> Target cards grid + cumulative chart
/transactions              -> Transaction list with filters
/import                    -> CSV upload + import history
/settings                  -> Tabs: Categories | Rules | Members | Accounts
/targets                   -> Target management (list + create/edit)
```

Five pages. That is the entire MVP frontend.

### 5.3 Layout

Root layout (`layout.tsx`) provides:
- **Left sidebar** (fixed, 240px): Navigation links + month selector dropdown
- **Main content area**: Page content

The month selector is in the sidebar because it is global context -- changing the month affects dashboard and transactions views. The selected month is stored as URL search params (`?year=2025&month=3`) so it persists across page navigation.

### 5.4 Page Details

#### Dashboard Page (`/dashboard`)

Two sections, stacked vertically:

**Section 1: Target Assessment Grid**
- Grid of target cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card shows:
  - Target name
  - Actual vs target value (e.g., "$223 / $250")
  - Status badge: green/yellow/red circle
  - Direction indicator (arrow up for at_least, arrow down for at_most, equals for exactly)
  - Small history row: colored dots for each month in the dataset (green/yellow/red), scrollable if many months
- Clicking a card scrolls to the cumulative chart with that target highlighted

**Section 2: Cumulative Progress Chart**
- Recharts `LineChart` component
- X-axis: days of the month (1-31)
- Y-axis: cumulative value (dollars for monetary, count for count; separate Y-axes if mixing types, but discouraged for MVP)
- One `Line` per active target, each a different color
- `ReferenceLine` per target at the target value (horizontal, dashed, matching color)
- Legend with checkboxes to show/hide individual target lines
- Tooltip showing exact values on hover

**Data fetching:** Client component. On mount and on month change, fetch `GET /api/v1/dashboard/assessments?year=X&month=Y` and `GET /api/v1/dashboard/cumulative?year=X&month=Y`. Two parallel fetch calls.

#### Transactions Page (`/transactions`)

- Filter bar at the top: category dropdown, person dropdown, search text input, date range (auto-set from month selector)
- shadcn/ui `DataTable` with columns: Date, Description, Amount, Category, Person
- Category column is editable inline -- clicking opens a dropdown to reassign category (calls `PATCH /api/v1/transactions/{id}/categorize`)
- When category is changed, a toast offers "Create rule from this?" which opens a small dialog pre-filled with a suggested pattern
- Pagination at the bottom (100 per page)
- "Uncategorized" quick filter button that sets `is_uncategorized=true`

**Data fetching:** Client component. Fetches on mount and when any filter changes. Debounce search input (300ms).

#### Import Page (`/import`)

- File drop zone (shadcn/ui or react-dropzone)
- Account selector dropdown (must select account before uploading)
- Upload button
- On successful import, show results summary (new/duplicate/categorized/uncategorized counts)
- Below: import history table (from `GET /api/v1/imports`)

#### Settings Page (`/settings`)

Four tabs (shadcn/ui `Tabs`):

**Categories tab:** List of categories with edit/delete. Add new category form at the top.

**Rules tab:** Ordered list of category rules. Each row: priority, pattern, match type, category, active toggle. Drag to reorder (updates priority). Add new rule form. "Test pattern" button that shows matching transactions before saving.

**Members tab:** List of household members. Edit card identifiers (comma-separated last-4 digits).

**Accounts tab:** List of accounts. Add new account form (name, institution, type).

#### Targets Page (`/targets`)

- List of all targets (active and inactive)
- Each target is a row/card showing name, type, direction, value, category/pattern, active toggle
- "Add Target" button opens a form (inline or dialog)
- Target form fields: name, type (monetary/count), direction (dropdown), value, tolerance upper/lower, period (monthly), person scope (dropdown from members + "Household"), category (dropdown), description pattern (text input), active toggle
- Edit inline or via dialog

### 5.5 Component Hierarchy (Key Views)

```
DashboardPage
├── MonthSelector (in sidebar, shared)
├── TargetGrid
│   └── TargetCard (repeated)
│       ├── StatusBadge
│       ├── ValueDisplay
│       └── HistoryDots
└── CumulativeProgressChart
    ├── LineChart (Recharts)
    ├── Line (per target)
    ├── ReferenceLine (per target)
    └── ChartLegend (with toggles)

TransactionsPage
├── TransactionFilters
│   ├── CategorySelect
│   ├── PersonSelect
│   ├── SearchInput
│   └── UncategorizedToggle
├── TransactionTable
│   └── TransactionRow (repeated)
│       └── CategorizeDropdown
└── Pagination

ImportPage
├── FileDropZone
├── AccountSelect
├── ImportResultsSummary
└── ImportHistoryTable
```

### 5.6 TypeScript Types

`src/types/index.ts` mirrors the Pydantic response schemas exactly. Example:

```typescript
export interface Transaction {
    id: number;
    date: string;
    description: string;
    raw_description: string;
    amount_cents: number;
    amount_display: string;
    account_id: number;
    account_name: string;
    household_member_id: number | null;
    household_member_name: string | null;
    category_id: number | null;
    category_name: string | null;
    is_manually_categorized: boolean;
}

export interface TargetAssessment {
    target_id: number;
    target_name: string;
    target_type: "monetary" | "count";
    direction: "at_most" | "at_least" | "exactly";
    actual_value: number;
    actual_display: string;
    target_value: number;
    target_display: string;
    tolerance_upper: number;
    tolerance_lower: number;
    status: "on_target" | "in_tolerance" | "off_target";
    percent_of_target: number;
    history: MonthStatus[];
}

export interface MonthStatus {
    year: number;
    month: number;
    status: "on_target" | "in_tolerance" | "off_target";
}

export type TargetType = "monetary" | "count";
export type Direction = "at_most" | "at_least" | "exactly";
export type MatchType = "substring" | "regex";
export type AccountType = "checking" | "credit" | "savings";
```

### 5.7 API Client (`src/lib/api.ts`)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...options?.headers },
        ...options,
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(res.status, error.detail);
    }
    return res.json();
}

// Typed functions for each endpoint
export const api = {
    dashboard: {
        getAssessments: (year: number, month: number) =>
            fetchApi<DashboardResponse>(`/dashboard/assessments?year=${year}&month=${month}`),
        getCumulative: (year: number, month: number, targetIds?: number[]) =>
            fetchApi<CumulativeResponse>(`/dashboard/cumulative?year=${year}&month=${month}${targetIds ? `&target_ids=${targetIds.join(",")}` : ""}`),
    },
    transactions: {
        list: (params: TransactionListParams) =>
            fetchApi<TransactionListResponse>(`/transactions?${new URLSearchParams(...)}`),
        categorize: (id: number, body: CategorizeRequest) =>
            fetchApi<CategorizeResponse>(`/transactions/${id}/categorize`, { method: "PATCH", body: JSON.stringify(body) }),
        getMonths: () =>
            fetchApi<MonthInfo[]>(`/transactions/months`),
    },
    // ... etc
};
```

---

## 6. Configuration

### Backend (`app/config.py`)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./budgetontarget.db"
    cors_origins: list[str] = ["http://localhost:3000"]
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="BOT_")
```

### Frontend (`.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### `.env.example`

```
# Backend
BOT_DATABASE_URL=sqlite:///./budgetontarget.db
BOT_CORS_ORIGINS=["http://localhost:3000"]
BOT_LOG_LEVEL=INFO

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 7. Database Setup and Migrations

### Alembic Configuration

`alembic.ini` points to the SQLite database. `alembic/env.py` imports all models from `app.models` to enable autogenerate.

```bash
# Initial setup (one-time)
cd backend
alembic init alembic
# Edit alembic/env.py to import models and set sqlalchemy.url from config

# Create initial migration
alembic revision --autogenerate -m "initial schema"

# Apply migrations
alembic upgrade head
```

### Seed Data

After first migration, run seed script:

```bash
cd backend
python -m app.seed.categories   # Creates default categories
python -m app.seed.rules        # Creates starter category rules
```

Default categories:
```
Income, Groceries, Dining Out, Gas, Utilities, Rent/Mortgage, Insurance,
Healthcare, Entertainment, Shopping, Subscriptions, Transportation,
Personal Care, Gifts, Education, Travel, Pet, Home, Clothing, Taxes,
Fees & Charges, Cash & ATM, Transfers, Other
```

---

## 8. Build and Run Instructions

### Prerequisites

- Python 3.12+ with `uv` installed
- Node.js 20+ with `pnpm` installed

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Run migrations
uv run alembic upgrade head

# Seed default data
uv run python -m app.seed.categories
uv run python -m app.seed.rules

# Start the server
uv run uvicorn app.main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Install shadcn/ui components (one-time)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card input label select table tabs badge dialog dropdown-menu toast separator

# Start dev server
pnpm dev
```

The frontend runs at `http://localhost:3000`.

### Both at Once

Add a root-level convenience script. Create `run.sh`:

```bash
#!/bin/bash
# Start backend and frontend in parallel
(cd backend && uv run uvicorn app.main:app --reload --port 8000) &
(cd frontend && pnpm dev) &
wait
```

---

## 9. Key Implementation Notes for Engineers

### 9.1 CORS

The FastAPI app must enable CORS for the frontend origin:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 9.2 Error Handling

Use FastAPI's `HTTPException` for all error responses. Standardize on:
- `400` for validation errors the framework does not catch
- `404` for not found
- `409` for conflicts (duplicate imports, category in use)
- `422` for request validation (FastAPI handles this automatically via Pydantic)

### 9.3 SQLite Considerations

- Enable WAL mode for concurrent reads during writes:
  ```python
  from sqlalchemy import event

  @event.listens_for(engine, "connect")
  def set_sqlite_pragma(dbapi_connection, connection_record):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA journal_mode=WAL")
      cursor.execute("PRAGMA foreign_keys=ON")
      cursor.close()
  ```
- SQLite does not enforce foreign keys by default. The pragma above enables them.
- SQLite has no native `BOOLEAN` type. SQLAlchemy handles this transparently (stores as 0/1).

### 9.4 File Upload Handling

The CSV file is received as `UploadFile` in FastAPI, read into memory as bytes, and passed to the parser. No filesystem storage of uploaded CSVs -- the data goes into the database and the file is discarded. The `csv_imports` table tracks what was imported.

```python
@router.post("/imports/upload")
async def upload_csv(
    file: UploadFile,
    account_id: int = Form(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    # ... pass to ImportService
```

### 9.5 Transaction Hash Collision Handling

The `external_hash` column has a `UNIQUE` constraint. During import, the importer queries for existing hashes in bulk before inserting:

```python
# Get all hashes for the import batch
new_hashes = {compute_transaction_hash(...) for row in parsed_rows}
existing_hashes = set(
    db.query(Transaction.external_hash)
    .filter(Transaction.external_hash.in_(new_hashes))
    .all()
)
# Only insert rows whose hash is not in existing_hashes
```

This is more efficient than catching unique constraint violations row by row.

### 9.6 Cumulative Chart Data Assembly

The frontend receives sparse data points (only dates with transactions). To render a smooth cumulative line:

```typescript
function fillCumulativeData(
    dataPoints: { date: string; cumulative_value: number }[],
    year: number,
    month: number
): { date: string; cumulative_value: number }[] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const filled: { date: string; cumulative_value: number }[] = [];
    let lastValue = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const point = dataPoints.find(p => p.date === dateStr);
        if (point) {
            lastValue = point.cumulative_value;
        }
        filled.push({ date: dateStr, cumulative_value: lastValue });
    }
    return filled;
}
```

### 9.7 Priority Numbering for Category Rules

Rules use integer priority, evaluated in ascending order (lower number = checked first). When creating a new rule:
- Default priority: `MAX(existing priorities) + 10`
- Spacing by 10 allows inserting rules between existing ones without renumbering
- A "reorder" endpoint is not needed for MVP -- users can edit priority values directly

---

## 10. Technical Decisions Log

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Monetary storage | Integer cents | Float, Decimal | No floating-point bugs. Simpler comparisons. Universal pattern. |
| Target assessment | Computed on the fly | Materialized table | Data is tiny (<1000 txns/month, <20 targets). Computing is <50ms. No cache invalidation complexity. |
| Category rule evaluation | In-memory Python loop | SQL LIKE/REGEXP | SQLite regex support is limited. Rules list is small. Python gives full regex. |
| Frontend state | URL params + React state | Zustand, Redux, TanStack Query | Two-person app with five pages. Global state manager is overhead for nothing. |
| Parsers | One parser per bank (class hierarchy) | Generic/configurable parser | Bank CSVs are too inconsistent for a generic approach. Explicit parsers are debuggable. |
| No Docker for MVP | Local Python + Node processes | Docker Compose | Personal tool. SQLite. One machine. Docker adds friction with zero benefit here. |
| Person scope on targets | String (member name) | Foreign key to household_members | Simpler to reason about. "Hayden" is more readable than member_id=1 in target definitions. Join on name at query time. Two-person household, no ambiguity risk. |
| No auth | None | Supabase Auth, basic auth | Runs on localhost for 2 people. Auth adds complexity with zero security benefit. |

---

## 11. What Is NOT in This Architecture

Explicitly out of scope for MVP. Do not build these:

- Account balance tracking
- Transaction splitting
- Trend analysis / forecasting / pace projection lines
- Recurring transaction detection
- PDF/CSV export
- Multi-bank CSV support (only one parser needed initially)
- Mobile-responsive design (desktop-first, responsive is Phase 2)
- Any authentication or authorization
- Docker / containerization
- CI/CD pipeline
- Tests beyond the four specified test files (parser, categorizer, target engine, importer)
- Database connection pooling (SQLite does not need it)
- Rate limiting (localhost)
- Caching layer
- WebSocket / real-time updates
