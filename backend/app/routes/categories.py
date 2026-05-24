from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)) -> list[CategoryResponse]:
    # Get categories with transaction counts via subquery
    categories = db.query(Category).order_by(Category.name).all()

    result = []
    for cat in categories:
        txn_count = (
            db.query(func.count(Transaction.id)).filter(Transaction.category_id == cat.id).scalar()
        )
        result.append(
            CategoryResponse(
                id=cat.id,
                name=cat.name,
                parent_category_id=cat.parent_category_id,
                transaction_count=txn_count or 0,
                created_at=cat.created_at,
            )
        )

    return result


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
) -> CategoryResponse:
    existing = db.query(Category).filter(Category.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{body.name}' already exists.")

    if body.parent_category_id is not None:
        parent = db.query(Category).filter(Category.id == body.parent_category_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found.")

    category = Category(name=body.name, parent_category_id=body.parent_category_id)
    db.add(category)
    db.commit()
    db.refresh(category)

    return CategoryResponse(
        id=category.id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        transaction_count=0,
        created_at=category.created_at,
    )


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
) -> CategoryResponse:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    if body.name is not None:
        category.name = body.name
    if body.parent_category_id is not None:
        category.parent_category_id = body.parent_category_id

    db.commit()
    db.refresh(category)

    txn_count = (
        db.query(func.count(Transaction.id)).filter(Transaction.category_id == category.id).scalar()
    )

    return CategoryResponse(
        id=category.id,
        name=category.name,
        parent_category_id=category.parent_category_id,
        transaction_count=txn_count or 0,
        created_at=category.created_at,
    )


@router.delete("/{category_id}", status_code=200)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
) -> dict:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    txn_count = (
        db.query(func.count(Transaction.id)).filter(Transaction.category_id == category_id).scalar()
    )
    rule_count = (
        db.query(func.count(CategoryRule.id))
        .filter(CategoryRule.category_id == category_id)
        .scalar()
    )

    if txn_count or rule_count:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Category is in use and cannot be deleted.",
                "transaction_count": txn_count or 0,
                "rule_count": rule_count or 0,
            },
        )

    db.delete(category)
    db.commit()
    return {"detail": "Category deleted."}
