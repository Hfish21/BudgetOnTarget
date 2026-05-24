from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class HouseholdMemberCreate(BaseModel):
    name: str


class HouseholdMemberUpdate(BaseModel):
    name: str


class HouseholdMemberResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
