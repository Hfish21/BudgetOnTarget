from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.category_rule import CategoryRule
from app.models.transaction import Transaction
from app.schemas.category_rule import (
    CategoryRuleCreate,
    CategoryRuleResponse,
    CategoryRuleUpdate,
    RecategorizeResponse,
    RuleTestMatch,
    RuleTestRequest,
    RuleTestResponse,
)
from app.services.categorizer import Categorizer

router = APIRouter(prefix="/category-rules", tags=["category-rules"])


def _to_response(rule: CategoryRule) -> CategoryRuleResponse:
    category_name = rule.category.name if rule.category else None
    return CategoryRuleResponse(
        id=rule.id,
        pattern=rule.pattern,
        match_type=rule.match_type,
        category_id=rule.category_id,
        category_name=category_name,
        priority=rule.priority,
        is_active=rule.is_active,
        created_at=rule.created_at,
    )


@router.get("", response_model=list[CategoryRuleResponse])
def list_category_rules(
    category_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[CategoryRuleResponse]:
    query = db.query(CategoryRule).order_by(CategoryRule.priority.asc())
    if category_id is not None:
        query = query.filter(CategoryRule.category_id == category_id)
    rules = query.all()
    return [_to_response(r) for r in rules]


@router.post("", response_model=CategoryRuleResponse, status_code=201)
def create_category_rule(
    body: CategoryRuleCreate,
    db: Session = Depends(get_db),
) -> CategoryRuleResponse:
    # Validate category exists
    category = db.query(Category).filter(Category.id == body.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")

    # Validate regex pattern if applicable
    if body.match_type == "regex":
        try:
            re.compile(body.pattern)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex pattern: {e}") from e

    rule = CategoryRule(
        pattern=body.pattern,
        match_type=body.match_type,
        category_id=body.category_id,
        priority=body.priority,
        is_active=body.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _to_response(rule)


@router.put("/{rule_id}", response_model=CategoryRuleResponse)
def update_category_rule(
    rule_id: int,
    body: CategoryRuleUpdate,
    db: Session = Depends(get_db),
) -> CategoryRuleResponse:
    rule = db.query(CategoryRule).filter(CategoryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Category rule not found.")

    if body.pattern is not None:
        rule.pattern = body.pattern
    if body.match_type is not None:
        rule.match_type = body.match_type
    if body.category_id is not None:
        category = db.query(Category).filter(Category.id == body.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found.")
        rule.category_id = body.category_id
    if body.priority is not None:
        rule.priority = body.priority
    if body.is_active is not None:
        rule.is_active = body.is_active

    db.commit()
    db.refresh(rule)
    return _to_response(rule)


@router.delete("/{rule_id}", status_code=200)
def delete_category_rule(
    rule_id: int,
    db: Session = Depends(get_db),
) -> dict:
    rule = db.query(CategoryRule).filter(CategoryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Category rule not found.")

    db.delete(rule)
    db.commit()
    return {"detail": "Category rule deleted."}


@router.post("/test", response_model=RuleTestResponse)
def test_rule(
    body: RuleTestRequest,
    db: Session = Depends(get_db),
) -> RuleTestResponse:
    """Test a pattern against existing transactions without saving."""
    if body.match_type == "regex":
        try:
            re.compile(body.pattern)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex pattern: {e}") from e

    transactions = db.query(Transaction).all()
    matches: list[RuleTestMatch] = []

    for txn in transactions:
        matched = False
        if body.match_type == "substring":
            matched = body.pattern.upper() in txn.description.upper()
        elif body.match_type == "regex":
            matched = bool(re.search(body.pattern, txn.description, re.IGNORECASE))

        if matched:
            matches.append(
                RuleTestMatch(
                    id=txn.id,
                    description=txn.description,
                    date=txn.date.isoformat(),
                )
            )

    return RuleTestResponse(
        match_count=len(matches),
        sample_matches=matches[:10],  # Limit samples
    )


@router.post("/recategorize", response_model=RecategorizeResponse)
def recategorize_all(
    db: Session = Depends(get_db),
) -> RecategorizeResponse:
    """Re-run all active rules against all non-manually-categorized transactions."""
    categorizer = Categorizer(db)
    updated_count = categorizer.recategorize_all(db)
    return RecategorizeResponse(updated_count=updated_count)
