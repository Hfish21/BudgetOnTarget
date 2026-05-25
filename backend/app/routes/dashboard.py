from __future__ import annotations

import calendar
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.target import Target
from app.schemas.dashboard import (
    AssessmentResponse,
    CumulativeDataPoint,
    CumulativeResponse,
    CumulativeTarget,
    DashboardAssessmentsResponse,
    MonthStatus,
    PeriodInfo,
)
from app.services.target_engine import TargetEngine, format_cents, get_month_bounds

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/assessments", response_model=DashboardAssessmentsResponse)
def get_assessments(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
) -> DashboardAssessmentsResponse:
    """Get target assessments for a given month, plus full history grid."""
    today = date.today()
    y = year if year is not None else today.year
    m = month if month is not None else today.month

    engine = TargetEngine(db)
    assessments = engine.assess_all_targets(y, m)

    # Get all available months for history
    available_months = engine.get_available_months()

    # Build assessment responses with history
    assessment_responses: list[AssessmentResponse] = []
    for assessment in assessments:
        target = db.query(Target).filter(Target.id == assessment.target_id).first()
        if not target:
            continue

        # Build history across all available months
        history: list[MonthStatus] = []
        for month_info in available_months:
            hist_start, hist_end = get_month_bounds(month_info["year"], month_info["month"])
            hist_assessment = engine.assess_target(target, hist_start, hist_end)
            history.append(
                MonthStatus(
                    year=month_info["year"],
                    month=month_info["month"],
                    status=hist_assessment.status,
                )
            )

        # Sort history chronologically
        history.sort(key=lambda h: (h.year, h.month))

        # Compute percent of target
        if assessment.target_value > 0:
            pct = round(assessment.actual_value / assessment.target_value * 100, 1)
        else:
            pct = 0.0

        is_monetary = assessment.target_type == "monetary"

        assessment_responses.append(
            AssessmentResponse(
                target_id=assessment.target_id,
                target_name=assessment.target_name,
                target_type=assessment.target_type,
                direction=assessment.direction,
                spend_group=target.spend_group,
                actual_value=assessment.actual_value,
                actual_display=(
                    format_cents(assessment.actual_value)
                    if is_monetary
                    else str(assessment.actual_value)
                ),
                target_value=assessment.target_value,
                target_display=(
                    format_cents(assessment.target_value)
                    if is_monetary
                    else str(assessment.target_value)
                ),
                tolerance_upper=assessment.tolerance_upper,
                tolerance_lower=assessment.tolerance_lower,
                status=assessment.status,
                percent_of_target=pct,
                history=history,
            )
        )

    label = f"{calendar.month_name[m]} {y}"
    return DashboardAssessmentsResponse(
        period=PeriodInfo(year=y, month=m, label=label),
        assessments=assessment_responses,
    )


@router.get("/cumulative", response_model=CumulativeResponse)
def get_cumulative(
    year: int = Query(...),
    month: int = Query(...),
    target_ids: str | None = None,
    db: Session = Depends(get_db),
) -> CumulativeResponse:
    """Get day-by-day cumulative data for targets in a given month."""
    engine = TargetEngine(db)
    period_start, period_end = get_month_bounds(year, month)

    # Parse target_ids
    if target_ids:
        ids = [int(x.strip()) for x in target_ids.split(",") if x.strip()]
        targets = db.query(Target).filter(Target.id.in_(ids)).all()
    else:
        targets = db.query(Target).filter(Target.is_active.is_(True)).all()

    cumulative_targets: list[CumulativeTarget] = []
    for target in targets:
        data_points = engine.get_cumulative_daily(target, period_start, period_end)
        is_monetary = target.target_type == "monetary"

        cumulative_targets.append(
            CumulativeTarget(
                target_id=target.id,
                target_name=target.name,
                target_value=target.value,
                target_display=(format_cents(target.value) if is_monetary else str(target.value)),
                direction=target.direction,
                spend_group=target.spend_group,
                data_points=[CumulativeDataPoint(**dp) for dp in data_points],
            )
        )

    label = f"{calendar.month_name[month]} {year}"
    return CumulativeResponse(
        period=PeriodInfo(year=year, month=month, label=label),
        targets=cumulative_targets,
    )
