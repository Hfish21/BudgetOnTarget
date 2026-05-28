from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Account,
    Category,
    CategoryRule,
    CsvImport,
    HouseholdMember,
    Tag,
    Target,
    Transaction,
    transaction_tags,
)
from app.schemas.budget_file import (
    CURRENT_VERSION,
    BudgetAccount,
    BudgetCategory,
    BudgetCategoryRule,
    BudgetCsvImport,
    BudgetFile,
    BudgetHouseholdMember,
    BudgetTag,
    BudgetTarget,
    BudgetTransaction,
)

router = APIRouter(prefix="/budget-file", tags=["budget-file"])


def _export_budget(db: Session) -> BudgetFile:
    tag_links: dict[int, list[int]] = {}
    for row in db.execute(text("SELECT transaction_id, tag_id FROM transaction_tags")):
        tag_links.setdefault(row[0], []).append(row[1])

    transactions = db.query(Transaction).order_by(Transaction.date, Transaction.id).all()

    return BudgetFile(
        version=CURRENT_VERSION,
        exported_at=datetime.now(timezone.utc),
        accounts=[
            BudgetAccount(
                id=a.id,
                name=a.name,
                institution=a.institution,
                account_type=a.account_type,
                owner_type=a.owner_type,
                household_member_id=a.household_member_id,
                created_at=a.created_at,
            )
            for a in db.query(Account).order_by(Account.id).all()
        ],
        household_members=[
            BudgetHouseholdMember(id=m.id, name=m.name, created_at=m.created_at)
            for m in db.query(HouseholdMember).order_by(HouseholdMember.id).all()
        ],
        categories=[
            BudgetCategory(
                id=c.id,
                name=c.name,
                parent_category_id=c.parent_category_id,
                created_at=c.created_at,
            )
            for c in db.query(Category).order_by(Category.id).all()
        ],
        category_rules=[
            BudgetCategoryRule(
                id=r.id,
                pattern=r.pattern,
                match_type=r.match_type,
                category_id=r.category_id,
                priority=r.priority,
                is_active=r.is_active,
                created_at=r.created_at,
            )
            for r in db.query(CategoryRule).order_by(CategoryRule.id).all()
        ],
        targets=[
            BudgetTarget(
                id=t.id,
                name=t.name,
                target_type=t.target_type,
                direction=t.direction,
                value=t.value,
                tolerance_upper=t.tolerance_upper,
                tolerance_lower=t.tolerance_lower,
                period=t.period,
                person_scope=t.person_scope,
                category_id=t.category_id,
                description_pattern=t.description_pattern,
                spend_group=t.spend_group,
                is_active=t.is_active,
                created_at=t.created_at,
            )
            for t in db.query(Target).order_by(Target.id).all()
        ],
        transactions=[
            BudgetTransaction(
                id=tx.id,
                external_hash=tx.external_hash,
                date=tx.date,
                description=tx.description,
                raw_description=tx.raw_description,
                amount_cents=tx.amount_cents,
                account_id=tx.account_id,
                household_member_id=tx.household_member_id,
                category_id=tx.category_id,
                usaa_category=tx.usaa_category,
                is_internal_transfer=tx.is_internal_transfer,
                is_manually_categorized=tx.is_manually_categorized,
                csv_import_id=tx.csv_import_id,
                tag_ids=tag_links.get(tx.id, []),
                created_at=tx.created_at,
            )
            for tx in transactions
        ],
        csv_imports=[
            BudgetCsvImport(
                id=ci.id,
                filename=ci.filename,
                file_hash=ci.file_hash,
                imported_at=ci.imported_at,
                row_count=ci.row_count,
                new_transaction_count=ci.new_transaction_count,
                account_id=ci.account_id,
            )
            for ci in db.query(CsvImport).order_by(CsvImport.id).all()
        ],
        tags=[
            BudgetTag(id=tg.id, name=tg.name, dimension=tg.dimension, created_at=tg.created_at)
            for tg in db.query(Tag).order_by(Tag.id).all()
        ],
    )


@router.get("/export", response_model=BudgetFile)
def export_budget(db: Session = Depends(get_db)) -> BudgetFile:
    return _export_budget(db)


def _import_budget(db: Session, data: BudgetFile) -> dict:
    if data.version > CURRENT_VERSION:
        raise HTTPException(
            status_code=400,
            detail=f"File version {data.version} is newer than supported version {CURRENT_VERSION}.",
        )

    counts: dict[str, int] = {}

    for m in data.household_members:
        db.add(HouseholdMember(id=m.id, name=m.name, created_at=m.created_at))
    counts["household_members"] = len(data.household_members)
    db.flush()

    for a in data.accounts:
        db.add(
            Account(
                id=a.id,
                name=a.name,
                institution=a.institution,
                account_type=a.account_type,
                owner_type=a.owner_type,
                household_member_id=a.household_member_id,
                created_at=a.created_at,
            )
        )
    counts["accounts"] = len(data.accounts)
    db.flush()

    for c in data.categories:
        db.add(
            Category(
                id=c.id,
                name=c.name,
                parent_category_id=c.parent_category_id,
                created_at=c.created_at,
            )
        )
    counts["categories"] = len(data.categories)
    db.flush()

    for r in data.category_rules:
        db.add(
            CategoryRule(
                id=r.id,
                pattern=r.pattern,
                match_type=r.match_type,
                category_id=r.category_id,
                priority=r.priority,
                is_active=r.is_active,
                created_at=r.created_at,
            )
        )
    counts["category_rules"] = len(data.category_rules)
    db.flush()

    for t in data.targets:
        db.add(
            Target(
                id=t.id,
                name=t.name,
                target_type=t.target_type,
                direction=t.direction,
                value=t.value,
                tolerance_upper=t.tolerance_upper,
                tolerance_lower=t.tolerance_lower,
                period=t.period,
                person_scope=t.person_scope,
                category_id=t.category_id,
                description_pattern=t.description_pattern,
                spend_group=t.spend_group,
                is_active=t.is_active,
                created_at=t.created_at,
            )
        )
    counts["targets"] = len(data.targets)
    db.flush()

    for ci in data.csv_imports:
        db.add(
            CsvImport(
                id=ci.id,
                filename=ci.filename,
                file_hash=ci.file_hash,
                imported_at=ci.imported_at,
                row_count=ci.row_count,
                new_transaction_count=ci.new_transaction_count,
                account_id=ci.account_id,
            )
        )
    counts["csv_imports"] = len(data.csv_imports)
    db.flush()

    for tg in data.tags:
        db.add(Tag(id=tg.id, name=tg.name, dimension=tg.dimension, created_at=tg.created_at))
    counts["tags"] = len(data.tags)
    db.flush()

    for tx in data.transactions:
        db.add(
            Transaction(
                id=tx.id,
                external_hash=tx.external_hash,
                date=tx.date,
                description=tx.description,
                raw_description=tx.raw_description,
                amount_cents=tx.amount_cents,
                account_id=tx.account_id,
                household_member_id=tx.household_member_id,
                category_id=tx.category_id,
                usaa_category=tx.usaa_category,
                is_internal_transfer=tx.is_internal_transfer,
                is_manually_categorized=tx.is_manually_categorized,
                csv_import_id=tx.csv_import_id,
                created_at=tx.created_at,
            )
        )
    counts["transactions"] = len(data.transactions)
    db.flush()

    tag_rows = []
    for tx in data.transactions:
        for tag_id in tx.tag_ids:
            tag_rows.append({"transaction_id": tx.id, "tag_id": tag_id})
    if tag_rows:
        db.execute(transaction_tags.insert(), tag_rows)
    counts["transaction_tags"] = len(tag_rows)

    db.commit()
    return counts


@router.post("/import")
async def import_budget(
    file: UploadFile,
    db: Session = Depends(get_db),
) -> JSONResponse:
    if not file.filename or not file.filename.endswith((".budget", ".json")):
        raise HTTPException(status_code=400, detail="File must be .budget or .json")

    content = await file.read()
    try:
        data = BudgetFile.model_validate_json(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid budget file: {e}")

    existing_count = db.query(Transaction).count()
    if existing_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Database already contains {existing_count} transactions. "
            "Import is only supported into an empty database to prevent conflicts. "
            "Back up and clear the database first, or use a fresh instance.",
        )

    counts = _import_budget(db, data)
    return JSONResponse(
        status_code=201,
        content={"status": "ok", "imported": counts},
    )
