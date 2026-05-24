from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.target import Target
from app.schemas.target import TargetCreate, TargetResponse, TargetUpdate
from app.services.target_engine import format_cents

router = APIRouter(prefix="/targets", tags=["targets"])


def _to_response(target: Target) -> TargetResponse:
    category_name = target.category.name if target.category else None
    is_monetary = target.target_type == "monetary"

    return TargetResponse(
        id=target.id,
        name=target.name,
        target_type=target.target_type,
        direction=target.direction,
        value=target.value,
        value_display=format_cents(target.value) if is_monetary else str(target.value),
        tolerance_upper=target.tolerance_upper,
        tolerance_lower=target.tolerance_lower,
        tolerance_upper_display=(
            format_cents(target.tolerance_upper) if is_monetary else str(target.tolerance_upper)
        ),
        tolerance_lower_display=(
            format_cents(target.tolerance_lower) if is_monetary else str(target.tolerance_lower)
        ),
        period=target.period,
        person_scope=target.person_scope,
        category_id=target.category_id,
        category_name=category_name,
        description_pattern=target.description_pattern,
        is_active=target.is_active,
        created_at=target.created_at,
    )


@router.get("", response_model=list[TargetResponse])
def list_targets(db: Session = Depends(get_db)) -> list[TargetResponse]:
    targets = db.query(Target).order_by(Target.name).all()
    return [_to_response(t) for t in targets]


@router.post("", response_model=TargetResponse, status_code=201)
def create_target(
    body: TargetCreate,
    db: Session = Depends(get_db),
) -> TargetResponse:
    if body.category_id is not None:
        category = db.query(Category).filter(Category.id == body.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found.")

    target = Target(
        name=body.name,
        target_type=body.target_type,
        direction=body.direction,
        value=body.value,
        tolerance_upper=body.tolerance_upper,
        tolerance_lower=body.tolerance_lower,
        period=body.period,
        person_scope=body.person_scope,
        category_id=body.category_id,
        description_pattern=body.description_pattern,
        is_active=body.is_active,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return _to_response(target)


@router.put("/{target_id}", response_model=TargetResponse)
def update_target(
    target_id: int,
    body: TargetUpdate,
    db: Session = Depends(get_db),
) -> TargetResponse:
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found.")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(target, field, value)

    db.commit()
    db.refresh(target)
    return _to_response(target)


@router.delete("/{target_id}", status_code=200)
def delete_target(
    target_id: int,
    db: Session = Depends(get_db),
) -> dict:
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found.")

    db.delete(target)
    db.commit()
    return {"detail": "Target deleted."}
