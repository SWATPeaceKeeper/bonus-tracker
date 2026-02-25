"""Time entry listing endpoint with filters."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TimeEntry
from app.schemas import TimeEntryRead

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"])


@router.get("", response_model=list[TimeEntryRead])
async def list_time_entries(
    project_id: int | None = Query(None),
    month: str | None = Query(None),
    employee: str | None = Query(None),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List time entries with optional filters."""
    stmt = select(TimeEntry).order_by(TimeEntry.date.desc())
    if project_id is not None:
        stmt = stmt.where(TimeEntry.project_id == project_id)
    if month:
        stmt = stmt.where(TimeEntry.month == month)
    if employee:
        stmt = stmt.where(TimeEntry.employee == employee)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()
