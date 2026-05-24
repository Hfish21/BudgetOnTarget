from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # One of: "monetary", "count"
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    # One of: "at_most", "at_least", "exactly"
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    # For monetary: value in cents. For count: the count as-is.
    tolerance_upper: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tolerance_lower: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Same unit as value (cents for monetary, count for count).
    period: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    # MVP: "monthly" only.
    person_scope: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # NULL = household (all members). Otherwise, the household_member name.
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    description_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Optional substring match on transaction description.
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    category: Mapped["Category | None"] = relationship(back_populates="targets")
