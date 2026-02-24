"""Pydantic schemas for API request/response models."""

from datetime import date, datetime, time

from pydantic import BaseModel, Field

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
    status: str = "aktiv"
    start_date: date | None = None


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
