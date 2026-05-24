from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction


class Categorizer:
    """Rule-based transaction categorizer.

    Loads all active CategoryRule rows ordered by priority ascending.
    For each transaction description, evaluates rules in order. First match wins.
    """

    def __init__(self, db: Session) -> None:
        self._rules: list[CategoryRule] = []
        self._load_rules(db)

    def _load_rules(self, db: Session) -> None:
        """Load all active rules ordered by priority ascending."""
        self._rules = (
            db.query(CategoryRule)
            .filter(CategoryRule.is_active.is_(True))
            .order_by(CategoryRule.priority.asc())
            .all()
        )

    def categorize(self, description: str) -> int | None:
        """Run description against rules in priority order.

        Returns category_id of first match, or None.
        - substring: case-insensitive containment check
        - regex: re.search with IGNORECASE
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
        """Re-run all rules against all non-manually-categorized transactions.

        Returns the count of updated rows.
        """
        # Reload rules to pick up any changes
        self._load_rules(db)

        transactions = (
            db.query(Transaction).filter(Transaction.is_manually_categorized.is_(False)).all()
        )

        updated_count = 0
        for txn in transactions:
            new_category_id = self.categorize(txn.description)
            if new_category_id != txn.category_id:
                txn.category_id = new_category_id
                updated_count += 1

        db.commit()
        return updated_count
