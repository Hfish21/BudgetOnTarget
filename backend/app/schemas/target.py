from __future__ import annotations

from datetime import datetime
from typing import Literal

SpendGroup = Literal["income", "necessary", "discretionary", "anomalous"]

from pydantic import BaseModel


class TargetCreate(BaseModel):
    name: str
    target_type: Literal["monetary", "count"]
    direction: Literal["at_most", "at_least", "exactly"]
    value: int
    tolerance_upper: int = 0
    tolerance_lower: int = 0
    period: str = "monthly"
    person_scope: str | None = None
    category_id: int | None = None
    description_pattern: str | None = None
    spend_group: SpendGroup = "necessary"
    is_active: bool = True


class TargetUpdate(BaseModel):
    name: str | None = None
    target_type: Literal["monetary", "count"] | None = None
    direction: Literal["at_most", "at_least", "exactly"] | None = None
    value: int | None = None
    tolerance_upper: int | None = None
    tolerance_lower: int | None = None
    period: str | None = None
    person_scope: str | None = None
    category_id: int | None = None
    description_pattern: str | None = None
    spend_group: SpendGroup | None = None
    is_active: bool | None = None


class TargetResponse(BaseModel):
    id: int
    name: str
    target_type: str
    direction: str
    value: int
    value_display: str
    tolerance_upper: int
    tolerance_lower: int
    tolerance_upper_display: str
    tolerance_lower_display: str
    period: str
    person_scope: str | None
    category_id: int | None
    category_name: str | None = None
    description_pattern: str | None
    spend_group: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
