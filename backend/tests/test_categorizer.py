from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction
from app.services.categorizer import Categorizer


class TestCategorizer:
    def test_substring_match(
        self,
        db_session: Session,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        categorizer = Categorizer(db_session)
        result = categorizer.categorize("PUBLIX #557 LAKE WALES FL")
        assert result == sample_categories["Groceries"].id

    def test_regex_match(
        self,
        db_session: Session,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        categorizer = Categorizer(db_session)
        result = categorizer.categorize("AMZN MKTP US*AB1CD2EF3")
        assert result == sample_categories["Shopping"].id

    def test_case_insensitive_substring(
        self,
        db_session: Session,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        categorizer = Categorizer(db_session)
        result = categorizer.categorize("publix store #123")
        assert result == sample_categories["Groceries"].id

    def test_no_match_returns_none(
        self,
        db_session: Session,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        categorizer = Categorizer(db_session)
        result = categorizer.categorize("RANDOM STORE XYZ")
        assert result is None

    def test_priority_order(self, db_session: Session):
        """Lower priority number wins when multiple rules match."""
        cat_a = Category(name="Category A")
        cat_b = Category(name="Category B")
        db_session.add_all([cat_a, cat_b])
        db_session.flush()

        # Both rules match "STORE", but cat_a has lower priority (wins)
        rule_a = CategoryRule(
            pattern="STORE",
            match_type="substring",
            category_id=cat_a.id,
            priority=5,
            is_active=True,
        )
        rule_b = CategoryRule(
            pattern="STORE",
            match_type="substring",
            category_id=cat_b.id,
            priority=15,
            is_active=True,
        )
        db_session.add_all([rule_a, rule_b])
        db_session.commit()

        categorizer = Categorizer(db_session)
        result = categorizer.categorize("STORE #123")
        assert result == cat_a.id

    def test_inactive_rules_skipped(self, db_session: Session):
        cat = Category(name="Test Cat")
        db_session.add(cat)
        db_session.flush()

        rule = CategoryRule(
            pattern="TEST",
            match_type="substring",
            category_id=cat.id,
            priority=10,
            is_active=False,
        )
        db_session.add(rule)
        db_session.commit()

        categorizer = Categorizer(db_session)
        result = categorizer.categorize("TEST STORE")
        assert result is None

    def test_recategorize_all(
        self,
        db_session: Session,
        sample_account,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        """recategorize_all should update non-manually-categorized transactions."""
        # Create an uncategorized transaction
        txn = Transaction(
            external_hash="abc123",
            date=date(2026, 5, 1),
            description="PUBLIX SUPER MARKET",
            raw_description="PUBLIX SUPER MARKET",
            amount_cents=-5000,
            account_id=sample_account.id,
            category_id=None,
            is_manually_categorized=False,
        )
        db_session.add(txn)
        db_session.commit()

        categorizer = Categorizer(db_session)
        count = categorizer.recategorize_all(db_session)

        assert count == 1
        db_session.refresh(txn)
        assert txn.category_id == sample_categories["Groceries"].id

    def test_recategorize_skips_manual(
        self,
        db_session: Session,
        sample_account,
        sample_categories: dict[str, Category],
        sample_rules: list[CategoryRule],
    ):
        """Manually categorized transactions should not be recategorized."""
        txn = Transaction(
            external_hash="manual123",
            date=date(2026, 5, 1),
            description="PUBLIX SUPER MARKET",
            raw_description="PUBLIX SUPER MARKET",
            amount_cents=-5000,
            account_id=sample_account.id,
            category_id=sample_categories["Gas"].id,  # Wrong category, but manual
            is_manually_categorized=True,
        )
        db_session.add(txn)
        db_session.commit()

        categorizer = Categorizer(db_session)
        count = categorizer.recategorize_all(db_session)

        assert count == 0
        db_session.refresh(txn)
        assert txn.category_id == sample_categories["Gas"].id
