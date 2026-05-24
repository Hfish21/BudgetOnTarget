from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    institution: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # One of: "checking", "credit", "savings"
    owner_type: Mapped[str] = mapped_column(String(50), nullable=False, default="joint")
    # One of: "joint", "personal"
    household_member_id: Mapped[int | None] = mapped_column(
        ForeignKey("household_members.id"), nullable=True
    )
    # NULL for joint accounts, set for personal accounts

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")
    csv_imports: Mapped[list["CsvImport"]] = relationship(back_populates="account")
    household_member: Mapped["HouseholdMember | None"] = relationship(back_populates="accounts")
