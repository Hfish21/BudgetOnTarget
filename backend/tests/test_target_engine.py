from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.target import Target
from app.models.transaction import Transaction
from app.services.target_engine import TargetEngine, format_cents, get_month_bounds


class TestGetMonthBounds:
    def test_january(self):
        start, end = get_month_bounds(2026, 1)
        assert start == date(2026, 1, 1)
        assert end == date(2026, 1, 31)

    def test_february_non_leap(self):
        start, end = get_month_bounds(2025, 2)
        assert start == date(2025, 2, 1)
        assert end == date(2025, 2, 28)

    def test_february_leap(self):
        start, end = get_month_bounds(2024, 2)
        assert start == date(2024, 2, 1)
        assert end == date(2024, 2, 29)

    def test_december(self):
        start, end = get_month_bounds(2025, 12)
        assert start == date(2025, 12, 1)
        assert end == date(2025, 12, 31)


class TestFormatCents:
    def test_positive(self):
        assert format_cents(2549) == "$25.49"

    def test_negative(self):
        assert format_cents(-2549) == "-$25.49"

    def test_zero(self):
        assert format_cents(0) == "$0.00"

    def test_large(self):
        assert format_cents(100000) == "$1,000.00"


class TestTargetEngine:
    def _create_spending_transactions(
        self,
        db: Session,
        account: Account,
        category: Category,
        amounts_cents: list[int],
        base_date: date | None = None,
    ) -> list[Transaction]:
        """Helper to create a set of negative (spending) transactions."""
        txns = []
        d = base_date or date(2026, 5, 1)
        for i, amt in enumerate(amounts_cents):
            txn = Transaction(
                external_hash=f"test_{d.isoformat()}_{i}_{amt}",
                date=date(d.year, d.month, d.day + i),
                description=f"TEST STORE #{i}",
                raw_description=f"TEST STORE #{i}",
                amount_cents=-abs(amt),  # Negative = spending
                account_id=account.id,
                category_id=category.id,
                is_internal_transfer=False,
                is_manually_categorized=False,
            )
            db.add(txn)
            txns.append(txn)
        db.commit()
        return txns

    def test_at_most_on_target(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Spending below target value = on_target."""
        groceries = sample_categories["Groceries"]
        self._create_spending_transactions(
            db_session, sample_account, groceries, [5000, 3000, 2000]
        )  # Total: $100

        target = Target(
            name="Test Budget",
            target_type="monetary",
            direction="at_most",
            value=20000,  # $200
            tolerance_upper=2000,
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        assert assessment.actual_value == 10000  # ABS(SUM) of spending
        assert assessment.target_value == 20000
        assert assessment.status == "on_target"

    def test_at_most_in_tolerance(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Spending above target but within tolerance = in_tolerance."""
        groceries = sample_categories["Groceries"]
        self._create_spending_transactions(
            db_session, sample_account, groceries, [10000, 8000, 3000]
        )  # Total: $210

        target = Target(
            name="Test Budget",
            target_type="monetary",
            direction="at_most",
            value=20000,  # $200
            tolerance_upper=2000,  # $20 tolerance
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        assert assessment.actual_value == 21000
        assert assessment.status == "in_tolerance"

    def test_at_most_off_target(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Spending above target + tolerance = off_target."""
        groceries = sample_categories["Groceries"]
        self._create_spending_transactions(
            db_session, sample_account, groceries, [15000, 15000]
        )  # Total: $300

        target = Target(
            name="Test Budget",
            target_type="monetary",
            direction="at_most",
            value=20000,  # $200
            tolerance_upper=2000,  # $20 tolerance
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        assert assessment.actual_value == 30000
        assert assessment.status == "off_target"

    def test_excludes_internal_transfers(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Internal transfers should be excluded from target calculations."""
        groceries = sample_categories["Groceries"]
        self._create_spending_transactions(db_session, sample_account, groceries, [5000])

        # Add an internal transfer
        transfer = Transaction(
            external_hash="transfer_123",
            date=date(2026, 5, 5),
            description="USAA CREDIT CARD PAYMENT",
            raw_description="USAA CREDIT CARD PAYMENT",
            amount_cents=-50000,
            account_id=sample_account.id,
            category_id=groceries.id,
            is_internal_transfer=True,
            is_manually_categorized=False,
        )
        db_session.add(transfer)
        db_session.commit()

        target = Target(
            name="Test Budget",
            target_type="monetary",
            direction="at_most",
            value=20000,
            tolerance_upper=0,
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        # Should only count the $50 transaction, not the $500 transfer
        assert assessment.actual_value == 5000

    def test_count_target(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Count targets count transactions rather than summing amounts."""
        fast_food = sample_categories["Fast Food"]
        self._create_spending_transactions(db_session, sample_account, fast_food, [1000, 800, 1200])

        target = Target(
            name="Fast Food Limit",
            target_type="count",
            direction="at_most",
            value=5,
            tolerance_upper=0,
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=fast_food.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        assert assessment.actual_value == 3
        assert assessment.status == "on_target"

    def test_no_transactions_returns_zero(
        self,
        db_session: Session,
        sample_categories: dict[str, Category],
    ):
        """Empty period should return actual_value of 0."""
        groceries = sample_categories["Groceries"]
        target = Target(
            name="Test Budget",
            target_type="monetary",
            direction="at_most",
            value=20000,
            tolerance_upper=0,
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        assessment = engine.assess_target(target, date(2026, 5, 1), date(2026, 5, 31))

        assert assessment.actual_value == 0
        assert assessment.status == "on_target"

    def test_cumulative_daily(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        """Cumulative daily should return running totals."""
        groceries = sample_categories["Groceries"]
        # Create transactions on specific dates
        for day, amt in [(1, 3000), (3, 2000), (3, 1000), (10, 5000)]:
            txn = Transaction(
                external_hash=f"cum_{day}_{amt}",
                date=date(2026, 5, day),
                description="TEST",
                raw_description="TEST",
                amount_cents=-amt,
                account_id=sample_account.id,
                category_id=groceries.id,
                is_internal_transfer=False,
                is_manually_categorized=False,
            )
            db_session.add(txn)
        db_session.commit()

        target = Target(
            name="Test",
            target_type="monetary",
            direction="at_most",
            value=20000,
            tolerance_upper=0,
            tolerance_lower=0,
            period="monthly",
            is_active=True,
            category_id=groceries.id,
        )
        db_session.add(target)
        db_session.commit()

        engine = TargetEngine(db_session)
        result = engine.get_cumulative_daily(target, date(2026, 5, 1), date(2026, 5, 31))

        assert len(result) == 3  # 3 unique dates
        assert result[0]["date"] == "2026-05-01"
        assert result[0]["cumulative_value"] == 3000
        assert result[1]["date"] == "2026-05-03"
        assert result[1]["cumulative_value"] == 6000  # 3000 + 2000 + 1000
        assert result[2]["date"] == "2026-05-10"
        assert result[2]["cumulative_value"] == 11000

    def test_get_available_months(
        self,
        db_session: Session,
        sample_account: Account,
        sample_categories: dict[str, Category],
    ):
        groceries = sample_categories["Groceries"]
        for m in [3, 5]:
            txn = Transaction(
                external_hash=f"month_{m}",
                date=date(2026, m, 15),
                description="TEST",
                raw_description="TEST",
                amount_cents=-1000,
                account_id=sample_account.id,
                category_id=groceries.id,
                is_internal_transfer=False,
                is_manually_categorized=False,
            )
            db_session.add(txn)
        db_session.commit()

        engine = TargetEngine(db_session)
        months = engine.get_available_months()

        assert len(months) == 2
        # Should be ordered descending
        assert months[0]["year"] == 2026
        assert months[0]["month"] == 5
        assert months[1]["month"] == 3
