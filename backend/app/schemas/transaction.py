from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class TransactionResponse(BaseModel):
    id: int
    date: str
    description: str
    raw_description: str
    amount_cents: int
    amount_display: str
    account_id: int
    account_name: str | None = None
    household_member_id: int | None
    household_member_name: str | None = None
    category_id: int | None
    category_name: str | None = None
    is_manually_categorized: bool
    is_internal_transfer: bool
    usaa_category: str | None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total_count: int
    limit: int
    offset: int


class CategorizeRequest(BaseModel):
    category_id: int
    create_rule: bool = False
    rule_pattern: str | None = None
    rule_match_type: Literal["substring", "regex"] | None = None


class CategorizeResponse(BaseModel):
    transaction: TransactionResponse
    rule_created: bool
    rule_id: int | None = None
    retroactive_count: int = 0


class MonthInfo(BaseModel):
    year: int
    month: int
    label: str
    transaction_count: int
