from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CsvImport(Base):
    __tablename__ = "csv_imports"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # SHA-256 of the entire file content. Used for whole-file dedup.
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    new_transaction_count: Mapped[int] = mapped_column(Integer, nullable=False)
    # How many rows were actually new (not duplicates).
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="csv_import")
    account: Mapped["Account"] = relationship(back_populates="csv_imports")
