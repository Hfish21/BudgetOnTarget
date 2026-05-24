from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.household_member import HouseholdMember
from app.schemas.household_member import (
    HouseholdMemberCreate,
    HouseholdMemberResponse,
    HouseholdMemberUpdate,
)

router = APIRouter(prefix="/household-members", tags=["household-members"])


@router.get("", response_model=list[HouseholdMemberResponse])
def list_household_members(db: Session = Depends(get_db)) -> list[HouseholdMemberResponse]:
    members = db.query(HouseholdMember).order_by(HouseholdMember.name).all()
    return [HouseholdMemberResponse.model_validate(m) for m in members]


@router.post("", response_model=HouseholdMemberResponse, status_code=201)
def create_household_member(
    body: HouseholdMemberCreate,
    db: Session = Depends(get_db),
) -> HouseholdMemberResponse:
    existing = db.query(HouseholdMember).filter(HouseholdMember.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Member '{body.name}' already exists.")

    member = HouseholdMember(name=body.name)
    db.add(member)
    db.commit()
    db.refresh(member)
    return HouseholdMemberResponse.model_validate(member)


@router.put("/{member_id}", response_model=HouseholdMemberResponse)
def update_household_member(
    member_id: int,
    body: HouseholdMemberUpdate,
    db: Session = Depends(get_db),
) -> HouseholdMemberResponse:
    member = db.query(HouseholdMember).filter(HouseholdMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Household member not found.")

    member.name = body.name
    db.commit()
    db.refresh(member)
    return HouseholdMemberResponse.model_validate(member)
