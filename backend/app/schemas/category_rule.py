from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CategoryRuleCreate(BaseModel):
    pattern: str
    match_type: Literal["substring", "regex"] = "substring"
    category_id: int
    priority: int = 0
    is_active: bool = True


class CategoryRuleUpdate(BaseModel):
    pattern: str | None = None
    match_type: Literal["substring", "regex"] | None = None
    category_id: int | None = None
    priority: int | None = None
    is_active: bool | None = None


class CategoryRuleResponse(BaseModel):
    id: int
    pattern: str
    match_type: str
    category_id: int
    category_name: str | None = None
    priority: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RecategorizeResponse(BaseModel):
    updated_count: int


class RuleTestRequest(BaseModel):
    pattern: str
    match_type: Literal["substring", "regex"] = "substring"


class RuleTestMatch(BaseModel):
    id: int
    description: str
    date: str


class RuleTestResponse(BaseModel):
    match_count: int
    sample_matches: list[RuleTestMatch]
