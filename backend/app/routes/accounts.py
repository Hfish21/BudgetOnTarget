from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _to_response(account: Account) -> AccountResponse:
    member_name = account.household_member.name if account.household_member else None
    return AccountResponse(
        id=account.id,
        name=account.name,
        institution=account.institution,
        account_type=account.account_type,
        owner_type=account.owner_type,
        household_member_id=account.household_member_id,
        household_member_name=member_name,
        created_at=account.created_at,
    )


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db)) -> list[AccountResponse]:
    accounts = db.query(Account).order_by(Account.name).all()
    return [_to_response(a) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=201)
def create_account(
    body: AccountCreate,
    db: Session = Depends(get_db),
) -> AccountResponse:
    existing = db.query(Account).filter(Account.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Account '{body.name}' already exists.")

    account = Account(
        name=body.name,
        institution=body.institution,
        account_type=body.account_type,
        owner_type=body.owner_type,
        household_member_id=body.household_member_id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return _to_response(account)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    body: AccountUpdate,
    db: Session = Depends(get_db),
) -> AccountResponse:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")

    if body.name is not None:
        account.name = body.name
    if body.institution is not None:
        account.institution = body.institution
    if body.account_type is not None:
        account.account_type = body.account_type
    if body.owner_type is not None:
        account.owner_type = body.owner_type
    if body.household_member_id is not None:
        account.household_member_id = body.household_member_id

    db.commit()
    db.refresh(account)
    return _to_response(account)
