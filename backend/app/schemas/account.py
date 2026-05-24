from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    institution: str
    account_type: Literal["checking", "credit", "savings"]
    owner_type: Literal["joint", "personal"] = "joint"
    household_member_id: int | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    institution: str | None = None
    account_type: Literal["checking", "credit", "savings"] | None = None
    owner_type: Literal["joint", "personal"] | None = None
    household_member_id: int | None = None


class AccountResponse(BaseModel):
    id: int
    name: str
    institution: str
    account_type: str
    owner_type: str
    household_member_id: int | None
    household_member_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
