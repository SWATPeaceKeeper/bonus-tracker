"""Pydantic schemas for API request/response models."""

from datetime import date, datetime, time

from pydantic import BaseModel, Field, field_validator

from app.config import STATUS_ACTIVE

# -- Project schemas --


class ProjectBase(BaseModel):
    """Shared project fields."""

    name: str
    client: str
    project_id: str
    deal_value: float | None = None
    budget_hours: float | None = None
    hourly_rate: float | None = None
    bonus_rate: float = 0.02
    status: str = STATUS_ACTIVE
    start_date: date | None = None
    onsite_hourly_rate: float | None = None
    project_manager: str | None = None
    customer_contact: str | None = None

    @field_validator("deal_value", "budget_hours", "hourly_rate", "onsite_hourly_rate")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("must be non-negative")
        return v

    @field_validator("bonus_rate")
    @classmethod
    def validate_bonus_rate(cls, v: float) -> float:
        if v < 0 or v > 1:
            raise ValueError("must be between 0 and 1")
        return v


class ProjectCreate(ProjectBase):
    """Fields required to create a project."""

    pass


class ProjectUpdate(BaseModel):
    """All fields optional for partial update."""

    name: str | None = None
    client: str | None = None
    deal_value: float | None = None
    budget_hours: float | None = None
    hourly_rate: float | None = None
    bonus_rate: float | None = None
    status: str | None = None
    start_date: date | None = None
    onsite_hourly_rate: float | None = None
    project_manager: str | None = None
    customer_contact: str | None = None

    @field_validator("deal_value", "budget_hours", "hourly_rate", "onsite_hourly_rate")
    @classmethod
    def validate_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("must be non-negative")
        return v

    @field_validator("bonus_rate")
    @classmethod
    def validate_bonus_rate(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 1):
            raise ValueError("must be between 0 and 1")
        return v


class ProjectRead(ProjectBase):
    """Project as returned by the API."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectWithHours(ProjectRead):
    """Project with aggregated hours and bonus info."""

    total_hours: float = 0.0
    bonus_amount: float = 0.0
    remote_hours: float = 0.0
    onsite_hours: float = 0.0


# -- TimeEntry schemas --


class TimeEntryRead(BaseModel):
    """Time entry as returned by the API."""

    id: int
    project_id: int
    date: date
    duration_decimal: float
    employee: str
    description: str
    start_time: time | None = None
    end_time: time | None = None
    month: str
    is_onsite: bool = False

    model_config = {"from_attributes": True}


# -- ImportBatch schemas --


class ImportBatchRead(BaseModel):
    """Import batch summary."""

    id: int
    filename: str
    imported_at: datetime
    row_count: int

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    """Result of a CSV import operation."""

    batch_id: int
    rows_imported: int
    projects_created: int
    projects_updated: int


# -- Report schemas --


class MonthlyProjectReport(BaseModel):
    """Per-project monthly breakdown for finance reports."""

    project_id: str
    project_name: str
    client: str
    month: str
    total_hours: float
    hourly_rate: float | None
    bonus_rate: float
    bonus_amount: float


class FinanceReportResponse(BaseModel):
    """Aggregated finance report across projects."""

    month: str
    projects: list[MonthlyProjectReport]
    total_hours: float
    total_bonus: float


class EmployeeHours(BaseModel):
    """Hours breakdown per employee for a project."""

    employee: str
    hours: float


class CustomerReportResponse(BaseModel):
    """Per-project report for customer communication."""

    project_id: str
    project_name: str
    client: str
    month: str
    total_hours: float
    budget_hours: float | None
    hours_remaining: float | None
    employees: list[EmployeeHours]
    note: str = ""


# -- CustomerReportNote schemas --


class CustomerReportNoteUpdate(BaseModel):
    """Update a customer report note."""

    note: str


class CustomerReportNoteRead(BaseModel):
    """Customer report note as returned by the API."""

    id: int
    project_id: int
    month: str
    note: str

    model_config = {"from_attributes": True}


# -- Dashboard schemas --


class DashboardStats(BaseModel):
    """Overview stats for the dashboard."""

    active_projects: int = 0
    total_hours_current_month: float = 0.0
    total_bonus_current_month: float = 0.0
    projects: list[ProjectWithHours] = Field(default_factory=list)


# -- Revenue schemas --


class RevenueProjectData(BaseModel):
    """Per-project revenue data."""

    id: int
    name: str
    client: str
    deal_value: float | None
    budget_hours: float | None
    total_hours: float
    remote_hours: float
    onsite_hours: float
    hourly_rate: float | None
    onsite_hourly_rate: float | None
    revenue: float
    budget_utilization: float | None
    status: str


class RevenueResponse(BaseModel):
    """Revenue KPI dashboard data."""

    total_deal_value: float
    total_revenue: float
    avg_budget_utilization: float
    active_projects: int
    projects: list[RevenueProjectData]
