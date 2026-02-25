"""PDF and CSV export endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CustomerReportNote, Project, TimeEntry
from app.services.bonus_calculator import calculate_bonus
from app.services.pdf_generator import (
    generate_customer_pdf,
    generate_finance_csv,
    generate_finance_pdf,
    safe_filename,
)

router = APIRouter(prefix="/api/exports", tags=["exports"])


@router.get("/customer-pdf/{project_id}")
async def export_customer_pdf(
    project_id: int,
    month: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Export a customer report as PDF download."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Monthly hours
    month_rows = await db.execute(
        select(
            TimeEntry.month,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.month == month,
            )
        )
        .group_by(TimeEntry.month)
        .order_by(TimeEntry.month)
    )
    monthly_data = [
        {"month": m, "hours": round(float(h), 2)}
        for m, h in month_rows.all()
    ]

    # Time entries grouped by month
    entries_result = await db.execute(
        select(TimeEntry)
        .where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.month == month,
            )
        )
        .order_by(TimeEntry.date)
    )
    entries = entries_result.scalars().all()

    entries_by_month: dict[str, list[dict]] = {}
    for e in entries:
        entries_by_month.setdefault(e.month, []).append({
            "date": e.date.strftime("%d.%m.%Y"),
            "employee": e.employee,
            "description": e.description,
            "hours": e.duration_decimal,
        })

    # Notes
    notes_result = await db.execute(
        select(CustomerReportNote).where(
            and_(
                CustomerReportNote.project_id == project_id,
                CustomerReportNote.month == month,
            )
        )
    )
    notes_by_month = {
        n.month: n.note for n in notes_result.scalars().all()
    }

    pdf_bytes = generate_customer_pdf(
        project_name=project.name,
        client=project.client,
        month=month,
        monthly_data=monthly_data,
        entries_by_month=entries_by_month,
        notes_by_month=notes_by_month,
        project_manager=project.project_manager,
        customer_contact=project.customer_contact,
    )

    filename = f"Kundenbericht_{safe_filename(project.client)}_{month}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/finance")
async def export_finance(
    year: int = Query(default=None),
    month: int | None = Query(default=None),
    export_format: str = Query(default="pdf", alias="format"),
    db: AsyncSession = Depends(get_db),
):
    """Export finance report as PDF or CSV."""
    if year is None:
        year = datetime.now().year

    projects_data = await _build_finance_data(db, year, month)

    suffix = f"{year}-{month:02d}" if month else str(year)

    if export_format == "csv":
        csv_content = generate_finance_csv(projects_data)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="Finanzbericht_{suffix}.csv"'
                )
            },
        )

    month_str = f"{year}-{month:02d}" if month else None
    pdf_bytes = generate_finance_pdf(year, projects_data, month_str=month_str)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="Finanzbericht_{suffix}.pdf"'
            )
        },
    )


async def _build_finance_data(
    db: AsyncSession, year: int, month: int | None = None
) -> list[dict]:
    """Build aggregated project data for finance export."""
    if month:
        month_filter = f"{year}-{month:02d}"
        month_condition = TimeEntry.month == month_filter
    else:
        year_prefix = str(year)
        month_condition = TimeEntry.month.startswith(year_prefix)

    # Get distinct projects with time entries in this period
    pid_result = await db.execute(
        select(TimeEntry.project_id)
        .where(month_condition)
        .distinct()
    )
    project_db_ids = [row[0] for row in pid_result.all()]

    projects_data = []
    for project_db_id in project_db_ids:
        project = await db.get(Project, project_db_id)
        if not project:
            continue

        remote_result = await db.execute(
            select(
                func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)
            ).where(
                and_(
                    TimeEntry.project_id == project_db_id,
                    month_condition,
                    TimeEntry.is_onsite == False,  # noqa: E712
                )
            )
        )
        remote_h = float(remote_result.scalar_one())

        onsite_result = await db.execute(
            select(
                func.coalesce(func.sum(TimeEntry.duration_decimal), 0.0)
            ).where(
                and_(
                    TimeEntry.project_id == project_db_id,
                    month_condition,
                    TimeEntry.is_onsite == True,  # noqa: E712
                )
            )
        )
        onsite_h = float(onsite_result.scalar_one())

        h = round(remote_h + onsite_h, 2)
        bonus = calculate_bonus(
            remote_hours=remote_h,
            onsite_hours=onsite_h,
            hourly_rate=project.hourly_rate,
            onsite_hourly_rate=project.onsite_hourly_rate,
            bonus_rate=project.bonus_rate,
        )
        projects_data.append({
            "project_name": project.name,
            "client": project.client,
            "hourly_rate": project.hourly_rate,
            "onsite_hourly_rate": project.onsite_hourly_rate,
            "bonus_rate": project.bonus_rate,
            "total_hours": h,
            "total_bonus": bonus,
        })
    return projects_data
