from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ImportResultResponse(BaseModel):
    csv_import_id: int
    filename: str
    total_rows: int
    new_transactions: int
    duplicate_transactions: int
    categorized_count: int
    uncategorized_count: int
    errors: list[str]


class CsvImportResponse(BaseModel):
    id: int
    filename: str
    file_hash: str
    imported_at: datetime
    row_count: int
    new_transaction_count: int
    account_id: int
    account_name: str | None = None

    model_config = {"from_attributes": True}
