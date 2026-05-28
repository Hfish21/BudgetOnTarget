"""
Schema for the portable .budget file format (v1).

A .budget file is JSON containing the complete state of a BudgetOnTarget
instance: accounts, members, categories, rules, targets, transactions,
import records, and tags. All references use integer IDs local to the file.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

CURRENT_VERSION = 1

SpendGroup = Literal["income", "necessary", "discretionary", "anomalous"]
TargetType = Literal["monetary", "count"]
Direction = Literal["at_most", "at_least", "exactly"]
MatchType = Literal["substring", "regex"]
AccountType = Literal["checking", "credit", "savings"]
OwnerType = Literal["joint", "personal"]


class BudgetAccount(BaseModel):
    id: int
    name: str
    institution: str
    account_type: AccountType
    owner_type: OwnerType = "joint"
    household_member_id: int | None = None
    created_at: datetime


class BudgetHouseholdMember(BaseModel):
    id: int
    name: str
    created_at: datetime


class BudgetCategory(BaseModel):
    id: int
    name: str
    parent_category_id: int | None = None
    created_at: datetime


class BudgetCategoryRule(BaseModel):
    id: int
    pattern: str
    match_type: MatchType = "substring"
    category_id: int
    priority: int = 0
    is_active: bool = True
    created_at: datetime


class BudgetTarget(BaseModel):
    id: int
    name: str
    target_type: TargetType
    direction: Direction
    value: int
    tolerance_upper: int = 0
    tolerance_lower: int = 0
    period: str = "monthly"
    person_scope: str | None = None
    category_id: int | None = None
    description_pattern: str | None = None
    spend_group: SpendGroup = "necessary"
    is_active: bool = True
    created_at: datetime


class BudgetTransaction(BaseModel):
    id: int
    external_hash: str
    date: date
    description: str
    raw_description: str
    amount_cents: int
    account_id: int
    household_member_id: int | None = None
    category_id: int | None = None
    usaa_category: str | None = None
    is_internal_transfer: bool = False
    is_manually_categorized: bool = False
    csv_import_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list)
    created_at: datetime


class BudgetCsvImport(BaseModel):
    id: int
    filename: str
    file_hash: str
    imported_at: datetime
    row_count: int
    new_transaction_count: int
    account_id: int


class BudgetTag(BaseModel):
    id: int
    name: str
    dimension: str
    created_at: datetime


class BudgetFile(BaseModel):
    version: int = CURRENT_VERSION
    exported_at: datetime
    source: str = "budgetontarget"
    accounts: list[BudgetAccount] = Field(default_factory=list)
    household_members: list[BudgetHouseholdMember] = Field(default_factory=list)
    categories: list[BudgetCategory] = Field(default_factory=list)
    category_rules: list[BudgetCategoryRule] = Field(default_factory=list)
    targets: list[BudgetTarget] = Field(default_factory=list)
    transactions: list[BudgetTransaction] = Field(default_factory=list)
    csv_imports: list[BudgetCsvImport] = Field(default_factory=list)
    tags: list[BudgetTag] = Field(default_factory=list)
