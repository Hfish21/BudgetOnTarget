from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    parent_category_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_category_id: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    parent_category_id: int | None
    transaction_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
