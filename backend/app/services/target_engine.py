from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date

from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.household_member import HouseholdMember
from app.models.target import Target
from app.models.transaction import Transaction


def get_month_bounds(year: int, month: int) -> tuple[date, date]:
    """Return (first_day, last_day) for the given year-month."""
    start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = date(year, month, last_day)
    return start, end


def format_cents(cents: int) -> str:
    """Format integer cents as a dollar string, e.g. 2549 -> '$25.49'."""
    prefix = "-" if cents < 0 else ""
    return f"{prefix}${abs(cents) / 100:,.2f}"


@dataclass
class TargetAssessment:
    target_id: int
    target_name: str
    target_type: str
    direction: str
    period_start: date
    period_end: date
    actual_value: int
    target_value: int
    tolerance_upper: int
    tolerance_lower: int
    status: str  # "on_target" | "in_tolerance" | "off_target"


class TargetEngine:
    """Computes target assessments on the fly against transaction data."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _build_base_query(
        self,
        target: Target,
        period_start: date,
        period_end: date,
    ):
        """Build the filtered query for a target's matching transactions."""
        query = self.db.query(Transaction).filter(
            Transaction.date >= period_start,
            Transaction.date <= period_end,
            Transaction.is_internal_transfer.is_(False),
        )

        if target.category_id is not None:
            query = query.filter(Transaction.category_id == target.category_id)
        elif target.spend_group in ("discretionary", "anomalous"):
            excluded_cat_ids = (
                self.db.query(Target.category_id)
                .filter(
                    Target.spend_group.in_(["necessary", "income"]),
                    Target.is_active.is_(True),
                    Target.category_id.isnot(None),
                )
                .distinct()
            )
            query = query.filter(
                (Transaction.category_id.notin_(excluded_cat_ids))
                | (Transaction.category_id.is_(None))
            )

        if target.description_pattern is not None:
            query = query.filter(
                Transaction.description.contains(target.description_pattern.upper())
            )

        if target.person_scope is not None:
            # Resolve person_scope (name) to household_member_id
            member = (
                self.db.query(HouseholdMember)
                .filter(HouseholdMember.name == target.person_scope)
                .first()
            )
            if member:
                query = query.filter(Transaction.household_member_id == member.id)
            else:
                # Person not found, return no results
                query = query.filter(Transaction.id < 0)

        return query

    def _compute_actual(
        self,
        target: Target,
        period_start: date,
        period_end: date,
    ) -> int:
        """Compute the actual value for a target in the given period."""
        query = self._build_base_query(target, period_start, period_end)

        if target.target_type == "count":
            result = query.count()
            return result

        # Monetary target
        if target.direction == "at_most":
            # Spending target: filter negative amounts, return ABS(SUM)
            query = query.filter(Transaction.amount_cents < 0)
            result = query.with_entities(sql_func.sum(Transaction.amount_cents)).scalar()
            return abs(result) if result else 0
        elif target.direction == "at_least":
            # Income target: filter positive amounts, return SUM
            query = query.filter(Transaction.amount_cents > 0)
            result = query.with_entities(sql_func.sum(Transaction.amount_cents)).scalar()
            return result if result else 0
        else:
            # "exactly": use ABS since these are typically known charges
            result = query.with_entities(sql_func.sum(Transaction.amount_cents)).scalar()
            return abs(result) if result else 0

    def _assess_status(self, actual: int, target: Target) -> str:
        """Determine target status: on_target, in_tolerance, or off_target."""
        value = target.value

        if target.direction == "at_most":
            if actual <= value:
                return "on_target"
            elif actual <= value + target.tolerance_upper:
                return "in_tolerance"
            else:
                return "off_target"

        elif target.direction == "at_least":
            if actual >= value:
                return "on_target"
            elif actual >= value - target.tolerance_lower:
                return "in_tolerance"
            else:
                return "off_target"

        else:  # exactly
            lower_bound = value - target.tolerance_lower
            upper_bound = value + target.tolerance_upper
            if lower_bound <= actual <= upper_bound:
                if actual == value:
                    return "on_target"
                return "in_tolerance"
            return "off_target"

    def assess_target(
        self,
        target: Target,
        period_start: date,
        period_end: date,
    ) -> TargetAssessment:
        """Assess a single target for a given period."""
        actual = self._compute_actual(target, period_start, period_end)
        status = self._assess_status(actual, target)

        return TargetAssessment(
            target_id=target.id,
            target_name=target.name,
            target_type=target.target_type,
            direction=target.direction,
            period_start=period_start,
            period_end=period_end,
            actual_value=actual,
            target_value=target.value,
            tolerance_upper=target.tolerance_upper,
            tolerance_lower=target.tolerance_lower,
            status=status,
        )

    def assess_all_targets(self, year: int, month: int) -> list[TargetAssessment]:
        """Assess all active targets for the given month."""
        period_start, period_end = get_month_bounds(year, month)
        targets = self.db.query(Target).filter(Target.is_active.is_(True)).all()
        return [self.assess_target(t, period_start, period_end) for t in targets]

    def get_cumulative_daily(
        self,
        target: Target,
        period_start: date,
        period_end: date,
    ) -> list[dict]:
        """Get day-by-day cumulative data for a target in a period.

        Returns list of dicts with 'date', 'cumulative_value', 'cumulative_display'.
        Only includes dates where matching transactions occurred.
        """
        query = self._build_base_query(target, period_start, period_end)

        # For at_most (spending) targets, filter negative amounts
        if target.target_type == "monetary" and target.direction == "at_most":
            query = query.filter(Transaction.amount_cents < 0)
        elif target.target_type == "monetary" and target.direction == "at_least":
            query = query.filter(Transaction.amount_cents > 0)

        if target.target_type == "count":
            # Group by date, count transactions
            daily = (
                query.with_entities(
                    Transaction.date,
                    sql_func.count().label("daily_total"),
                )
                .group_by(Transaction.date)
                .order_by(Transaction.date)
                .all()
            )
        else:
            # Group by date, sum amounts
            daily = (
                query.with_entities(
                    Transaction.date,
                    sql_func.sum(Transaction.amount_cents).label("daily_total"),
                )
                .group_by(Transaction.date)
                .order_by(Transaction.date)
                .all()
            )

        # Compute cumulative sum
        result: list[dict] = []
        cumulative = 0
        for row in daily:
            daily_val = row.daily_total or 0
            if target.target_type == "monetary":
                daily_val = abs(daily_val)
            cumulative += daily_val
            result.append(
                {
                    "date": row.date.isoformat(),
                    "cumulative_value": cumulative,
                    "cumulative_display": (
                        format_cents(cumulative)
                        if target.target_type == "monetary"
                        else str(cumulative)
                    ),
                }
            )

        return result

    def get_available_months(self) -> list[dict]:
        """Get distinct year-month combinations from transactions.

        Returns list of dicts with 'year', 'month', 'label', 'transaction_count'.
        """
        year_col = sql_func.strftime("%Y", Transaction.date).label("year")
        month_col = sql_func.strftime("%m", Transaction.date).label("month")

        results = (
            self.db.query(
                year_col,
                month_col,
                sql_func.count().label("transaction_count"),
            )
            .group_by(year_col, month_col)
            .order_by(year_col.desc(), month_col.desc())
            .all()
        )

        months: list[dict] = []
        for row in results:
            y = int(row.year)
            m = int(row.month)
            label = f"{calendar.month_name[m]} {y}"
            months.append(
                {
                    "year": y,
                    "month": m,
                    "label": label,
                    "transaction_count": row.transaction_count,
                }
            )

        return months
