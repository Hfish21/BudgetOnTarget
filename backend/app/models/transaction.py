from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", Integer, ForeignKey("transactions.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # SHA-256 of (date + amount_cents + raw_description + account_id)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    # Cleaned/normalized description for display and rule matching
    raw_description: Mapped[str] = mapped_column(String(500), nullable=False)
    # Original description from CSV, preserved verbatim
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # Positive = money in (income, refunds). Negative = money out (spending).

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    household_member_id: Mapped[int | None] = mapped_column(
        ForeignKey("household_members.id"), nullable=True
    )
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    usaa_category: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Original category from USAA CSV, stored as-is
    is_internal_transfer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_manually_categorized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    csv_import_id: Mapped[int | None] = mapped_column(ForeignKey("csv_imports.id"), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=func.now())

    account: Mapped["Account"] = relationship(back_populates="transactions")
    household_member: Mapped["HouseholdMember | None"] = relationship(back_populates="transactions")
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    csv_import: Mapped["CsvImport | None"] = relationship(back_populates="transactions")
    tags: Mapped[list["Tag"]] = relationship(
        secondary=transaction_tags, back_populates="transactions"
    )

    __table_args__ = (
        Index("ix_transactions_date", "date"),
        Index("ix_transactions_category_id", "category_id"),
        Index("ix_transactions_household_member_id", "household_member_id"),
        Index("ix_transactions_date_category", "date", "category_id"),
    )
