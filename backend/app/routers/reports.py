"""Report endpoints for dashboard, finance, project detail, and customer reports."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CustomerReportNote, Project, TimeEntry
from app.schemas import (
    CustomerReportNoteRead,
    CustomerReportNoteUpdate,
    CustomerReportResponse,
    DashboardStats,
    EmployeeHours,
    FinanceReportResponse,
    MonthlyProjectReport,
    ProjectWithHours,
)
from app.services.bonus_calculator import calculate_bonus

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Return dashboard KPIs: active projects, current month hours, bonus."""
    current_month = datetime.now().strftime("%Y-%m")

    active_count = await db.scalar(
        select(func.count(Project.id)).where(Project.status == "aktiv")
    )

    hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.month == current_month
        )
    )
    hours_this_month = float(hours_result.scalar_one())

    # Build per-project stats for active projects
    projects_result = await db.execute(
        select(Project).where(Project.status == "aktiv").order_by(Project.name)
    )
    projects = projects_result.scalars().all()

    project_stats = []
    total_bonus = 0.0
    for p in projects:
        h_result = await db.execute(
            select(
                func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)
            ).where(
                and_(
                    TimeEntry.project_id == p.id,
                    TimeEntry.month == current_month,
                )
            )
        )
        h = float(h_result.scalar_one())
        bonus = calculate_bonus(h, p.hourly_rate, p.bonus_rate)
        total_bonus += bonus
        project_stats.append(
            ProjectWithHours(
                id=p.id,
                project_id=p.project_id,
                name=p.name,
                client=p.client,
                deal_value=p.deal_value,
                budget_hours=p.budget_hours,
                hourly_rate=p.hourly_rate,
                bonus_rate=p.bonus_rate,
                status=p.status,
                start_date=p.start_date,
                created_at=p.created_at,
                updated_at=p.updated_at,
                total_hours=round(h, 2),
                bonus_amount=bonus,
            )
        )

    return DashboardStats(
        active_projects=active_count or 0,
        total_hours_current_month=round(hours_this_month, 2),
        total_bonus_current_month=round(total_bonus, 2),
        projects=project_stats,
    )


@router.get("/finance", response_model=list[FinanceReportResponse])
async def get_finance_report(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return per-month finance breakdown across all projects."""
    if year is None:
        year = datetime.now().year

    year_prefix = str(year)

    # Get all months with data
    months_result = await db.execute(
        select(TimeEntry.month)
        .where(TimeEntry.month.startswith(year_prefix))
        .distinct()
        .order_by(TimeEntry.month)
    )
    months = [row[0] for row in months_result.all()]

    reports = []
    for month in months:
        project_reports, total_h, total_b = await _finance_for_month(
            db, month
        )
        reports.append(
            FinanceReportResponse(
                month=month,
                projects=project_reports,
                total_hours=round(total_h, 2),
                total_bonus=round(total_b, 2),
            )
        )
    return reports


async def _finance_for_month(db: AsyncSession, month: str):
    """Build per-project finance data for a single month."""
    rows = await db.execute(
        select(
            TimeEntry.project_id,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(TimeEntry.month == month)
        .group_by(TimeEntry.project_id)
    )

    project_reports = []
    total_hours = 0.0
    total_bonus = 0.0

    for project_db_id, hours in rows.all():
        project = await db.get(Project, project_db_id)
        if not project:
            continue
        h = float(hours)
        bonus = calculate_bonus(h, project.hourly_rate, project.bonus_rate)
        total_hours += h
        total_bonus += bonus
        project_reports.append(
            MonthlyProjectReport(
                project_id=project.project_id,
                project_name=project.name,
                client=project.client,
                month=month,
                total_hours=round(h, 2),
                hourly_rate=project.hourly_rate,
                bonus_rate=project.bonus_rate,
                bonus_amount=bonus,
            )
        )
    return project_reports, total_hours, total_bonus


@router.get("/project/{project_id}")
async def get_project_report(
    project_id: int,
    month: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return detailed project report with monthly and employee breakdown."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Monthly breakdown
    month_query = (
        select(
            TimeEntry.month,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(TimeEntry.project_id == project_id)
        .group_by(TimeEntry.month)
        .order_by(TimeEntry.month)
    )
    month_rows = await db.execute(month_query)
    monthly = [
        {
            "month": m,
            "hours": round(float(h), 2),
            "bonus": calculate_bonus(
                float(h), project.hourly_rate, project.bonus_rate
            ),
        }
        for m, h in month_rows.all()
    ]

    # Employee breakdown
    emp_query = (
        select(
            TimeEntry.employee,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(TimeEntry.project_id == project_id)
        .group_by(TimeEntry.employee)
        .order_by(func.sum(TimeEntry.duration_decimal).desc())
    )
    if month:
        emp_query = emp_query.where(TimeEntry.month == month)
    emp_rows = await db.execute(emp_query)
    employees = [
        {"employee": e, "total_hours": round(float(h), 2)}
        for e, h in emp_rows.all()
    ]

    total_hours = sum(m["hours"] for m in monthly)
    total_bonus = sum(m["bonus"] for m in monthly)

    return {
        "project": {
            "id": project.id,
            "project_id": project.project_id,
            "name": project.name,
            "client": project.client,
            "budget_hours": project.budget_hours,
            "hourly_rate": project.hourly_rate,
            "bonus_rate": project.bonus_rate,
            "status": project.status,
        },
        "total_hours": round(total_hours, 2),
        "total_bonus": round(total_bonus, 2),
        "budget_remaining": (
            round(project.budget_hours - total_hours, 2)
            if project.budget_hours
            else None
        ),
        "monthly_breakdown": monthly,
        "employee_breakdown": employees,
    }


@router.get(
    "/customer/{project_id}",
    response_model=CustomerReportResponse,
)
async def get_customer_report(
    project_id: int,
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return customer-facing report for a project and month."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.month == month,
            )
        )
    )
    total_hours = float(hours_result.scalar_one())

    # Employee breakdown for this month
    emp_result = await db.execute(
        select(
            TimeEntry.employee,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.month == month,
            )
        )
        .group_by(TimeEntry.employee)
    )
    employees = [
        EmployeeHours(employee=e, hours=round(float(h), 2))
        for e, h in emp_result.all()
    ]

    # Get note
    note_result = await db.execute(
        select(CustomerReportNote).where(
            and_(
                CustomerReportNote.project_id == project_id,
                CustomerReportNote.month == month,
            )
        )
    )
    note_obj = note_result.scalar_one_or_none()

    # Calculate total hours across all months for budget remaining
    all_hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.project_id == project_id
        )
    )
    all_hours = float(all_hours_result.scalar_one())

    return CustomerReportResponse(
        project_id=project.project_id,
        project_name=project.name,
        client=project.client,
        month=month,
        total_hours=round(total_hours, 2),
        budget_hours=project.budget_hours,
        hours_remaining=(
            round(project.budget_hours - all_hours, 2)
            if project.budget_hours
            else None
        ),
        employees=employees,
        note=note_obj.note if note_obj else "",
    )


@router.post(
    "/customer/{project_id}/notes",
    response_model=CustomerReportNoteRead,
)
async def upsert_customer_note(
    project_id: int,
    data: CustomerReportNoteUpdate,
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a customer report note for a project/month."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(CustomerReportNote).where(
            and_(
                CustomerReportNote.project_id == project_id,
                CustomerReportNote.month == month,
            )
        )
    )
    note = result.scalar_one_or_none()

    if note:
        note.note = data.note
    else:
        note = CustomerReportNote(
            project_id=project_id, month=month, note=data.note
        )
        db.add(note)

    await db.commit()
    await db.refresh(note)
    return note
