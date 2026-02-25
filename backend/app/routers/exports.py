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
    year: int = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Export a customer report as PDF download."""
    if year is None:
        year = datetime.now().year

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    year_prefix = str(year)

    # Monthly hours
    month_rows = await db.execute(
        select(
            TimeEntry.month,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(
            and_(
                TimeEntry.project_id == project_id,
                TimeEntry.month.startswith(year_prefix),
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
                TimeEntry.month.startswith(year_prefix),
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
                CustomerReportNote.month.startswith(year_prefix),
            )
        )
    )
    notes_by_month = {
        n.month: n.note for n in notes_result.scalars().all()
    }

    pdf_bytes = generate_customer_pdf(
        project_name=project.name,
        client=project.client,
        year=year,
        monthly_data=monthly_data,
        entries_by_month=entries_by_month,
        notes_by_month=notes_by_month,
    )

    filename = f"Kundenbericht_{safe_filename(project.client)}_{year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/finance")
async def export_finance(
    year: int = Query(default=None),
    export_format: str = Query(default="pdf", alias="format"),
    db: AsyncSession = Depends(get_db),
):
    """Export finance report as PDF or CSV."""
    if year is None:
        year = datetime.now().year

    projects_data = await _build_finance_data(db, year)

    if export_format == "csv":
        csv_content = generate_finance_csv(projects_data)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="Finanzbericht_{year}.csv"'
                )
            },
        )

    pdf_bytes = generate_finance_pdf(year, projects_data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="Finanzbericht_{year}.pdf"'
            )
        },
    )


async def _build_finance_data(
    db: AsyncSession, year: int
) -> list[dict]:
    """Build aggregated project data for finance export."""
    year_prefix = str(year)

    result = await db.execute(
        select(
            TimeEntry.project_id,
            func.sum(TimeEntry.duration_decimal),
        )
        .where(TimeEntry.month.startswith(year_prefix))
        .group_by(TimeEntry.project_id)
    )

    projects_data = []
    for project_db_id, total_hours in result.all():
        project = await db.get(Project, project_db_id)
        if not project:
            continue
        h = round(float(total_hours), 2)
        bonus = calculate_bonus(h, project.hourly_rate, project.bonus_rate)
        projects_data.append({
            "project_name": project.name,
            "client": project.client,
            "hourly_rate": project.hourly_rate,
            "bonus_rate": project.bonus_rate,
            "total_hours": h,
            "total_bonus": bonus,
        })
    return projects_data
