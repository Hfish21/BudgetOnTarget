from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.target import Target
from app.models.transaction import Transaction
from app.schemas.transaction import (
    CategorizeRequest,
    CategorizeResponse,
    MonthInfo,
    TransactionListResponse,
    TransactionResponse,
)
from app.services.categorizer import Categorizer
from app.services.target_engine import format_cents, get_month_bounds

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _txn_to_response(txn: Transaction) -> TransactionResponse:
    account_name = txn.account.name if txn.account else None
    member_name = txn.household_member.name if txn.household_member else None
    category_name = txn.category.name if txn.category else None

    return TransactionResponse(
        id=txn.id,
        date=txn.date.isoformat(),
        description=txn.description,
        raw_description=txn.raw_description,
        amount_cents=txn.amount_cents,
        amount_display=format_cents(txn.amount_cents),
        account_id=txn.account_id,
        account_name=account_name,
        household_member_id=txn.household_member_id,
        household_member_name=member_name,
        category_id=txn.category_id,
        category_name=category_name,
        is_manually_categorized=txn.is_manually_categorized,
        is_internal_transfer=txn.is_internal_transfer,
        usaa_category=txn.usaa_category,
    )


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    year: int | None = None,
    month: int | None = None,
    category_id: int | None = None,
    household_member_id: int | None = None,
    is_uncategorized: bool | None = None,
    spend_group: str | None = None,
    search: str | None = None,
    sort_by: str = Query(default="date", pattern="^(date|amount_cents|description)$"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TransactionListResponse:
    query = db.query(Transaction)

    # Date filters
    if year is not None and month is not None:
        period_start, period_end = get_month_bounds(year, month)
        query = query.filter(
            Transaction.date >= period_start,
            Transaction.date <= period_end,
        )
    elif year is not None:
        query = query.filter(
            Transaction.date >= date(year, 1, 1),
            Transaction.date <= date(year, 12, 31),
        )

    if category_id is not None:
        query = query.filter(Transaction.category_id == category_id)
    elif spend_group is not None:
        lane_cat_ids = (
            db.query(Target.category_id)
            .filter(
                Target.spend_group == spend_group,
                Target.is_active.is_(True),
                Target.category_id.isnot(None),
            )
            .distinct()
        )
        query = query.filter(Transaction.category_id.in_(lane_cat_ids))

    if household_member_id is not None:
        query = query.filter(Transaction.household_member_id == household_member_id)

    if is_uncategorized is True:
        query = query.filter(Transaction.category_id.is_(None))

    if search:
        query = query.filter(Transaction.description.contains(search.upper()))

    # Get total count before pagination
    total_count = query.count()

    # Sorting
    sort_column = getattr(Transaction, sort_by)
    if sort_dir == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Pagination
    transactions = query.offset(offset).limit(limit).all()

    return TransactionListResponse(
        transactions=[_txn_to_response(t) for t in transactions],
        total_count=total_count,
        limit=limit,
        offset=offset,
    )


@router.get("/months", response_model=list[MonthInfo])
def list_months(db: Session = Depends(get_db)) -> list[MonthInfo]:
    """Get list of months that have transaction data."""
    from app.services.target_engine import TargetEngine

    engine = TargetEngine(db)
    months = engine.get_available_months()
    return [MonthInfo(**m) for m in months]


@router.patch("/{transaction_id}/categorize", response_model=CategorizeResponse)
def categorize_transaction(
    transaction_id: int,
    body: CategorizeRequest,
    db: Session = Depends(get_db),
) -> CategorizeResponse:
    """Manually assign a category to a transaction, optionally creating a rule."""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    # Validate category exists
    category = db.query(Category).filter(Category.id == body.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    # Update transaction
    txn.category_id = body.category_id
    txn.is_manually_categorized = True

    rule_created = False
    rule_id = None
    retroactive_count = 0

    if body.create_rule and body.rule_pattern:
        match_type = body.rule_match_type or "substring"

        # Determine priority: max existing + 10
        max_priority = db.query(func.max(CategoryRule.priority)).scalar() or 0
        new_priority = max_priority + 10

        rule = CategoryRule(
            pattern=body.rule_pattern,
            match_type=match_type,
            category_id=body.category_id,
            priority=new_priority,
            is_active=True,
        )
        db.add(rule)
        db.flush()
        rule_created = True
        rule_id = rule.id

        # Retroactively apply the new rule
        categorizer = Categorizer(db)
        uncategorized = (
            db.query(Transaction)
            .filter(
                Transaction.is_manually_categorized.is_(False),
                Transaction.category_id.is_(None),
                Transaction.id != transaction_id,
            )
            .all()
        )

        for other_txn in uncategorized:
            cat_id = categorizer.categorize(other_txn.description)
            if cat_id is not None:
                other_txn.category_id = cat_id
                retroactive_count += 1

    db.commit()
    db.refresh(txn)

    return CategorizeResponse(
        transaction=_txn_to_response(txn),
        rule_created=rule_created,
        rule_id=rule_id,
        retroactive_count=retroactive_count,
    )
