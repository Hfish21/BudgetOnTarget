from __future__ import annotations

from pydantic import BaseModel


class PeriodInfo(BaseModel):
    year: int
    month: int
    label: str


class MonthStatus(BaseModel):
    year: int
    month: int
    status: str


class AssessmentResponse(BaseModel):
    target_id: int
    target_name: str
    target_type: str
    direction: str
    spend_group: str
    actual_value: int
    actual_display: str
    target_value: int
    target_display: str
    tolerance_upper: int
    tolerance_lower: int
    status: str
    percent_of_target: float
    history: list[MonthStatus]


class DashboardAssessmentsResponse(BaseModel):
    period: PeriodInfo
    assessments: list[AssessmentResponse]


class CumulativeDataPoint(BaseModel):
    date: str
    cumulative_value: int
    cumulative_display: str


class CumulativeTarget(BaseModel):
    target_id: int
    target_name: str
    target_value: int
    target_display: str
    direction: str
    spend_group: str
    data_points: list[CumulativeDataPoint]


class CumulativeResponse(BaseModel):
    period: PeriodInfo
    targets: list[CumulativeTarget]


class TargetHistoryMonth(BaseModel):
    year: int
    month: int
    label: str
    actual_value: int
    actual_display: str
    target_value: int
    target_display: str
    status: str


class TargetHistoryResponse(BaseModel):
    target_id: int
    target_name: str
    direction: str
    months: list[TargetHistoryMonth]


class LaneHistoryMonth(BaseModel):
    year: int
    month: int
    label: str
    actual_value: int
    actual_display: str
    target_value: int
    target_display: str
    status: str


class LaneHistoryResponse(BaseModel):
    spend_group: str
    months: list[LaneHistoryMonth]
