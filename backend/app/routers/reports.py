"""Report endpoints for dashboard, finance, project detail, and customer reports."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STATUS_ACTIVE
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
    ProjectDetailReport,
    ProjectWithHours,
    RevenueProjectData,
    RevenueResponse,
)
from app.services.bonus_calculator import calculate_bonus
from app.services.hours_service import get_hours_by_month, get_hours_by_project

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Return dashboard KPIs: active projects, current month hours, bonus."""
    current_month = datetime.now(UTC).strftime("%Y-%m")

    active_count = await db.scalar(
        select(func.count(Project.id)).where(Project.status == STATUS_ACTIVE)
    )

    hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.month == current_month
        )
    )
    hours_this_month = float(hours_result.scalar_one())

    # Build per-project stats for active projects (single batch query)
    projects_result = await db.execute(
        select(Project).where(Project.status == STATUS_ACTIVE).order_by(Project.name)
    )
    projects = list(projects_result.scalars().all())

    hours_map = await get_hours_by_project(
        db, [p.id for p in projects], TimeEntry.month == current_month
    )

    project_stats = []
    total_bonus = 0.0
    for p in projects:
        remote_h, onsite_h = hours_map.get(p.id, (0.0, 0.0))
        h = remote_h + onsite_h
        bonus = calculate_bonus(
            remote_hours=remote_h,
            onsite_hours=onsite_h,
            hourly_rate=p.hourly_rate,
            onsite_hourly_rate=p.onsite_hourly_rate,
            bonus_rate=p.bonus_rate,
        )
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
                onsite_hourly_rate=p.onsite_hourly_rate,
                bonus_rate=p.bonus_rate,
                status=p.status,
                start_date=p.start_date,
                created_at=p.created_at,
                updated_at=p.updated_at,
                total_hours=round(h, 2),
                bonus_amount=bonus,
                remote_hours=round(remote_h, 2),
                onsite_hours=round(onsite_h, 2),
            )
        )

    # YTD data
    current_year = datetime.now(UTC).strftime("%Y")
    ytd_hours_result = await db.execute(
        select(func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)).where(
            TimeEntry.month.startswith(current_year)
        )
    )
    ytd_hours = float(ytd_hours_result.scalar_one())

    # YTD bonus and revenue: reuse projects + hours_map pattern for whole year
    ytd_hours_map = await get_hours_by_project(
        db, [p.id for p in projects], TimeEntry.month.startswith(current_year)
    )
    ytd_bonus = 0.0
    ytd_revenue = 0.0
    for p in projects:
        remote_h, onsite_h = ytd_hours_map.get(p.id, (0.0, 0.0))
        rate = p.hourly_rate or 0.0
        onsite_rate = p.onsite_hourly_rate or rate
        ytd_bonus += calculate_bonus(
            remote_hours=remote_h,
            onsite_hours=onsite_h,
            hourly_rate=p.hourly_rate,
            onsite_hourly_rate=p.onsite_hourly_rate,
            bonus_rate=p.bonus_rate,
        )
        ytd_revenue += remote_h * rate + onsite_h * onsite_rate

    return DashboardStats(
        active_projects=active_count or 0,
        total_hours_current_month=round(hours_this_month, 2),
        total_bonus_current_month=round(total_bonus, 2),
        projects=project_stats,
        ytd_hours=round(ytd_hours, 2),
        ytd_bonus=round(ytd_bonus, 2),
        ytd_revenue=round(ytd_revenue, 2),
    )


@router.get("/finance", response_model=list[FinanceReportResponse])
async def get_finance_report(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return per-month finance breakdown across all projects."""
    if year is None:
        year = datetime.now(UTC).year

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
        project_reports, total_h, total_b = await _finance_for_month(db, month)
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
    # Get distinct projects with time entries in this month
    pid_rows = await db.execute(
        select(TimeEntry.project_id).where(TimeEntry.month == month).distinct()
    )
    project_db_ids = [row[0] for row in pid_rows.all()]
    if not project_db_ids:
        return [], 0.0, 0.0

    # Batch-load projects and hours
    proj_result = await db.execute(select(Project).where(Project.id.in_(project_db_ids)))
    projects_by_id = {p.id: p for p in proj_result.scalars().all()}
    hours_map = await get_hours_by_project(db, project_db_ids, TimeEntry.month == month)

    project_reports = []
    total_hours = 0.0
    total_bonus = 0.0

    for pid in project_db_ids:
        project = projects_by_id.get(pid)
        if not project:
            continue

        remote_h, onsite_h = hours_map.get(pid, (0.0, 0.0))
        h = remote_h + onsite_h
        bonus = calculate_bonus(
            remote_hours=remote_h,
            onsite_hours=onsite_h,
            hourly_rate=project.hourly_rate,
            onsite_hourly_rate=project.onsite_hourly_rate,
            bonus_rate=project.bonus_rate,
        )
        total_hours += h
        total_bonus += bonus
        project_reports.append(
            MonthlyProjectReport(
                project_id=project.project_id,
                project_name=project.name,
                client=project.client,
                month=month,
                total_hours=round(h, 2),
                remote_hours=round(remote_h, 2),
                onsite_hours=round(onsite_h, 2),
                hourly_rate=project.hourly_rate,
                onsite_hourly_rate=project.onsite_hourly_rate,
                bonus_rate=project.bonus_rate,
                bonus_amount=bonus,
            )
        )
    return project_reports, total_hours, total_bonus


@router.get("/project/{project_id}", response_model=ProjectDetailReport)
async def get_project_report(
    project_id: int,
    month: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Return detailed project report with monthly and employee breakdown."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Monthly breakdown — single query grouped by month + is_onsite
    month_hours = await get_hours_by_month(db, project_id)

    monthly = []
    for m in sorted(month_hours.keys()):
        remote_h, onsite_h = month_hours[m]
        h = remote_h + onsite_h
        bonus = calculate_bonus(
            remote_hours=remote_h,
            onsite_hours=onsite_h,
            hourly_rate=project.hourly_rate,
            onsite_hourly_rate=project.onsite_hourly_rate,
            bonus_rate=project.bonus_rate,
        )
        monthly.append(
            {
                "month": m,
                "hours": round(h, 2),
                "remote_hours": round(remote_h, 2),
                "onsite_hours": round(onsite_h, 2),
                "bonus": bonus,
            }
        )

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
    employees = [{"employee": e, "total_hours": round(float(h), 2)} for e, h in emp_rows.all()]

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
            "onsite_hourly_rate": project.onsite_hourly_rate,
            "bonus_rate": project.bonus_rate,
            "status": project.status,
        },
        "total_hours": round(total_hours, 2),
        "total_bonus": round(total_bonus, 2),
        "budget_remaining": (
            round(project.budget_hours - total_hours, 2) if project.budget_hours else None
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
    employees = [EmployeeHours(employee=e, hours=round(float(h), 2)) for e, h in emp_result.all()]

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
            round(project.budget_hours - all_hours, 2) if project.budget_hours else None
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
        note = CustomerReportNote(project_id=project_id, month=month, note=data.note)
        db.add(note)

    await db.commit()
    await db.refresh(note)
    return note


@router.get("/employees")
async def get_employee_report(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return employee utilization data."""
    if year is None:
        year = datetime.now(UTC).year
    year_prefix = str(year)

    # Get all employees with hours in this year
    result = await db.execute(
        select(
            TimeEntry.employee,
            TimeEntry.project_id,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(TimeEntry.month.startswith(year_prefix))
        .group_by(TimeEntry.employee, TimeEntry.project_id)
        .order_by(TimeEntry.employee)
    )
    rows = result.all()

    # Get project names
    project_ids = list({r[1] for r in rows})
    if project_ids:
        proj_result = await db.execute(
            select(Project.id, Project.name).where(
                Project.id.in_(project_ids)
            )
        )
        project_names = {
            pid: name for pid, name in proj_result.all()
        }
    else:
        project_names = {}

    # Build employee data
    employee_map: dict[str, dict] = {}
    for employee, project_id, hours in rows:
        if employee not in employee_map:
            employee_map[employee] = {
                "employee": employee,
                "total_hours": 0.0,
                "projects": [],
            }
        emp = employee_map[employee]
        emp["total_hours"] += float(hours)
        emp["projects"].append({
            "project_id": project_id,
            "project_name": project_names.get(
                project_id, "Unbekannt"
            ),
            "hours": round(float(hours), 2),
        })

    employees = sorted(
        employee_map.values(),
        key=lambda e: e["total_hours"],
        reverse=True,
    )
    for emp in employees:
        emp["total_hours"] = round(emp["total_hours"], 2)
        emp["project_count"] = len(emp["projects"])

    return employees


@router.get("/revenue", response_model=RevenueResponse)
async def get_revenue(
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Return revenue KPI dashboard data."""
    if year is None:
        year = datetime.now(UTC).year
    year_prefix = str(year)

    result = await db.execute(
        select(Project).where(Project.status == STATUS_ACTIVE).order_by(Project.name)
    )
    projects = list(result.scalars().all())

    hours_map = await get_hours_by_project(
        db, [p.id for p in projects], TimeEntry.month.startswith(year_prefix)
    )

    total_deal = 0.0
    total_rev = 0.0
    utilizations: list[float] = []
    project_data: list[RevenueProjectData] = []

    for p in projects:
        remote_h, onsite_h = hours_map.get(p.id, (0.0, 0.0))
        rate = p.hourly_rate or 0.0
        onsite_rate = p.onsite_hourly_rate or rate
        revenue = remote_h * rate + onsite_h * onsite_rate
        total_h = remote_h + onsite_h

        util = round(total_h / p.budget_hours, 2) if p.budget_hours else None
        if util is not None:
            utilizations.append(util)

        if p.deal_value:
            total_deal += p.deal_value
        total_rev += revenue

        project_data.append(
            RevenueProjectData(
                id=p.id,
                name=p.name,
                client=p.client,
                deal_value=p.deal_value,
                budget_hours=p.budget_hours,
                total_hours=round(total_h, 2),
                remote_hours=round(remote_h, 2),
                onsite_hours=round(onsite_h, 2),
                hourly_rate=p.hourly_rate,
                onsite_hourly_rate=p.onsite_hourly_rate,
                revenue=round(revenue, 2),
                budget_utilization=util,
                status=p.status,
            )
        )

    avg_util = round(sum(utilizations) / len(utilizations), 2) if utilizations else 0.0

    return RevenueResponse(
        total_deal_value=round(total_deal, 2),
        total_revenue=round(total_rev, 2),
        avg_budget_utilization=avg_util,
        active_projects=len(projects),
        projects=project_data,
    )
